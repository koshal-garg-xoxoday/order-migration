require('dotenv').config();
const { connectToMsSQL, connectToMySQL } = require('./db/connection');
const { fetchOrders, fetchVoucherDetails } = require('./db/mssql');
const { insertOrder } = require('./db/mysql');
const { transformOrderData } = require('./utils/transformer');
const { generateMigrationReport } = require('./utils/report');
const { logger } = require('./utils/logger');

// Configuration
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100;
const STORE_ID = process.env.STORE_ID || 'MTB';

/**
 * Validates that the data in MySQL matches the source data from MS SQL
 * @param {Object} mysqlPool - MySQL Connection Pool
 * @param {Object} sourceOrder - The original MS SQL order data
 * @param {string} orderId - The order ID to validate
 * @returns {Promise<Object>} - Validation result with discrepancies if any
 */
async function validateMigration(mysqlPool, sourceOrder, orderId) {
  try {
    const conn = await mysqlPool.getConnection();
    
    try {
      // Fetch the order from MySQL
      const [orderRows] = await conn.query(
        'SELECT * FROM `order` WHERE order_id = ?',
        [orderId]
      );
      
      if (orderRows.length === 0) {
        return { 
          isValid: false, 
          errors: ['Order not found in MySQL'] 
        };
      }
      
      const mysqlOrder = orderRows[0];
      
      // Fetch order products
      const [productRows] = await conn.query(
        'SELECT * FROM order_product WHERE order_id = ?',
        [orderId]
      );
      
      // Fetch order totals
      const [totalRows] = await conn.query(
        'SELECT * FROM order_total WHERE order_id = ?',
        [orderId]
      );
      
      // Fetch voucher details
      const [voucherRows] = await conn.query(
        'SELECT * FROM egift_voucher_details WHERE order_id = ?',
        [orderId]
      );
      
      // Compare key fields between source and destination
      const discrepancies = [];
      
      // Check basic order information
      const orderFields = [
        { field: 'customer_id', msField: 'customerid' },
        { field: 'store_id', msField: 'storeid' },
        { field: 'total', msField: 'orderPrice', transform: parseFloat },
        { field: 'currency_code', msField: 'Currency' },
      ];
      
      for (const { field, msField, transform } of orderFields) {
        const msValue = transform ? transform(sourceOrder[msField]) : sourceOrder[msField];
        const mysqlValue = mysqlOrder[field];
        
        if (msValue !== mysqlValue && String(msValue) !== String(mysqlValue)) {
          discrepancies.push({
            type: 'order',
            field,
            msValue,
            mysqlValue,
          });
        }
      }
      
      // Check products
      if (sourceOrder.productid) {
        const matchingProduct = productRows.find(p => 
          String(p.product_id) === String(sourceOrder.productid)
        );
        
        if (!matchingProduct) {
          discrepancies.push({
            type: 'product',
            error: `Product ${sourceOrder.productid} not found in MySQL`
          });
        } else {
          // Compare product details
          const productFields = [
            { field: 'name', msField: 'name' },
            { field: 'quantity', msField: 'quantity', transform: parseInt },
            { field: 'price', msField: 'itemPrice', transform: parseFloat }
          ];
          
          for (const { field, msField, transform } of productFields) {
            const msValue = transform ? transform(sourceOrder[msField]) : sourceOrder[msField];
            const mysqlValue = transform ? transform(matchingProduct[field]) : matchingProduct[field];
            
            if (msValue !== mysqlValue && String(msValue) !== String(mysqlValue)) {
              discrepancies.push({
                type: 'product',
                field,
                msValue,
                mysqlValue,
              });
            }
          }
        }
      }
      
      // Check totals
      const orderTotal = totalRows.find(t => t.code === 'total');
      if (!orderTotal) {
        discrepancies.push({
          type: 'total',
          error: 'Order total not found in MySQL'
        });
      } else if (parseFloat(sourceOrder.orderPrice) !== parseFloat(orderTotal.value)) {
        discrepancies.push({
          type: 'total',
          field: 'value',
          msValue: parseFloat(sourceOrder.orderPrice),
          mysqlValue: parseFloat(orderTotal.value),
        });
      }
      
      return {
        isValid: discrepancies.length === 0,
        discrepancies: discrepancies.length > 0 ? discrepancies : null
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error('Error validating migration:', error);
    return { 
      isValid: false, 
      errors: ['Validation failed due to error: ' + error.message] 
    };
  }
}

async function migrateOrders() {
  logger.info('Starting order migration process...');
  
  let mssqlPool = null;
  let mysqlPool = null;
  
  try {
    // Connect to databases
    mssqlPool = await connectToMsSQL();
    mysqlPool = await connectToMySQL();
    
    let offset = 0;
    let hasMoreRecords = true;
    let totalProcessed = 0;
    let successCount = 0;
    let failureCount = 0;
    let validationFailures = 0;
    
    // Track detailed information for reporting
    const failedOrders = [];
    const validationFailureDetails = [];
    
    logger.info(`Processing orders in batches of ${BATCH_SIZE}...`);
    
    // Process in batches
    while (hasMoreRecords) {
      // Fetch a batch of orders from MS SQL
      const orders = await fetchOrders(mssqlPool, STORE_ID, BATCH_SIZE, offset);
      
      if (orders.length === 0) {
        hasMoreRecords = false;
        break;
      }
      
      logger.info(`Processing batch of ${orders.length} orders starting at offset ${offset}...`);
      
      // Process each order
      for (const order of orders) {
        try {
          // Fetch voucher details for this order
          const vouchers = await fetchVoucherDetails(mssqlPool, order.id);
          
          // Transform the data
          const transformedOrder = transformOrderData(order, vouchers);
          
          // Insert into MySQL
          const result = await insertOrder(mysqlPool, transformedOrder);
          
          if (result.success) {
            // Validate the migrated data
            const validationResult = await validateMigration(mysqlPool, order, order.id);
            
            if (validationResult.isValid) {
              successCount++;
              logger.info(`Successfully migrated and validated order ${order.id}`);
            } else {
              validationFailures++;
              logger.error(`Order ${order.id} validation failed:`, validationResult.discrepancies);
              
              // Log detailed discrepancies for troubleshooting
              for (const discrepancy of validationResult.discrepancies || []) {
                logger.error(
                  `  - ${discrepancy.type} field "${discrepancy.field}": ` +
                  `MS SQL value: "${discrepancy.msValue}", ` +
                  `MySQL value: "${discrepancy.mysqlValue}"`
                );
              }
              
              // Add to validation failures list for reporting
              validationFailureDetails.push({
                orderId: order.id,
                discrepancies: validationResult.discrepancies,
                errors: validationResult.errors
              });
            }
          } else {
            failureCount++;
            logger.error(`Failed to migrate order ${order.id}: ${result.error}`);
            
            // Add to failed orders list for reporting
            failedOrders.push({
              orderId: order.id,
              error: result.error
            });
          }
        } catch (error) {
          failureCount++;
          logger.error(`Error processing order ${order.id}:`, error);
          
          // Add to failed orders list for reporting
          failedOrders.push({
            orderId: order.id,
            error: error.message
          });
        }
        
        totalProcessed++;
      }
      
      offset += BATCH_SIZE;
      
      logger.info(`Batch complete. Total processed: ${totalProcessed}, Success: ${successCount}, Failures: ${failureCount}, Validation Failures: ${validationFailures}`);
    }
    
    logger.info('Migration complete!');
    logger.info(`Total Orders Processed: ${totalProcessed}`);
    logger.info(`Successfully Migrated and Validated: ${successCount}`);
    logger.info(`Failed to Migrate: ${failureCount}`);
    logger.info(`Validation Failures: ${validationFailures}`);
    
    // Generate migration report
    const migrationStats = {
      totalProcessed,
      successCount,
      failureCount,
      validationFailures
    };
    
    const reportResult = await generateMigrationReport(
      migrationStats,
      failedOrders,
      validationFailureDetails
    );
    
    if (reportResult.error) {
      logger.error('Failed to generate migration report:', reportResult.error);
    } else {
      logger.info(`Full migration report available at: ${reportResult.reportPath}`);
    }
    
    if (validationFailures > 0) {
      logger.warn('WARNING: Some orders were migrated but failed validation.');
      logger.warn('Please check the report for details and consider re-running the migration for these orders.');
    }
    
  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    // Close database connections
    if (mssqlPool) {
      await mssqlPool.close();
      logger.info('Closed MS SQL connection');
    }
    
    if (mysqlPool) {
      await mysqlPool.end();
      logger.info('Closed MySQL connection');
    }
  }
}

// Execute the migration
migrateOrders().catch(error => {
  logger.error('Unhandled error during migration:', error);
  process.exit(1);
}); 