const sql = require('mssql');
require('dotenv').config();
const { logger } = require('../utils/logger');

/**
 * Fetch orders from MS SQL Server
 * @param {sql.ConnectionPool} pool - MS SQL Connection Pool
 * @param {string} storeId - Store ID to filter orders
 * @param {number} limit - Maximum number of records to retrieve
 * @param {number} offset - Starting offset for pagination
 * @returns {Promise<Array>} - Array of order records
 */
async function fetchOrders(pool, storeId, limit = 100, offset = 0) {
  try {
    const request = pool.request();
    
    const query = getOrdersSql(limit, offset, storeId);
    logger.info(query);    
    const result = await request.query(query);
    logger.info(result.recordset);
    if(result.recordset.length > 0){
      // Execute all SQL queries in parallel
      const orderDetails = await fetchOrderDetails(request, result.recordset);
      const { 
        lineItemResult,
        paymentResult, 
        voucherResult,
        dynamicObjResult,
        userInputResult,
        shipmentResult,
        shipmentItemResult,
        addressResult
      } = orderDetails;

      logger.info('Additional order data fetched successfully');
      const orders = result.recordset.map(order => 
        processOrderDetails(order, {
          addressResult,
          shipmentResult, 
          lineItemResult,
          paymentResult,
          voucherResult,
          dynamicObjResult,
          userInputResult,
          shipmentItemResult
        })
      );
      return orders;
    }
  } catch (error) {
    logger.error('Error fetching orders from MS SQL:', error);
    throw error;
  }
}

module.exports = {
  fetchOrders
}; 