const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

/**
 * Generates a detailed migration report
 * @param {Object} stats - Migration statistics
 * @param {Array} failedOrders - List of failed orders
 * @param {Array} validationFailures - List of validation failures
 */
async function generateMigrationReport(stats, failedOrders, validationFailures) {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const reportDir = path.join(process.cwd(), 'reports');
    
    // Create reports directory if it doesn't exist
    try {
      await fs.mkdir(reportDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    
    // Create report file
    const reportPath = path.join(reportDir, `migration-report-${timestamp}.txt`);
    
    let reportContent = `=== ORDER MIGRATION REPORT (${timestamp}) ===\n\n`;
    
    // Summary section
    reportContent += `SUMMARY:\n`;
    reportContent += `- Total Orders Processed: ${stats.totalProcessed}\n`;
    reportContent += `- Successfully Migrated: ${stats.successCount}\n`;
    reportContent += `- Migration Failures: ${stats.failureCount}\n`;
    reportContent += `- Validation Failures: ${stats.validationFailures}\n\n`;
    
    // Failed orders section
    if (failedOrders.length > 0) {
      reportContent += `FAILED ORDERS:\n`;
      failedOrders.forEach(order => {
        reportContent += `- Order ID: ${order.orderId}\n`;
        reportContent += `  Error: ${order.error}\n`;
      });
      reportContent += `\n`;
    }
    
    // Validation failures section
    if (validationFailures.length > 0) {
      reportContent += `VALIDATION FAILURES:\n`;
      validationFailures.forEach(failure => {
        reportContent += `- Order ID: ${failure.orderId}\n`;
        if (failure.discrepancies && failure.discrepancies.length > 0) {
          reportContent += `  Discrepancies:\n`;
          failure.discrepancies.forEach(discrepancy => {
            if (discrepancy.error) {
              reportContent += `    - ${discrepancy.type}: ${discrepancy.error}\n`;
            } else {
              reportContent += `    - ${discrepancy.type} field "${discrepancy.field}": `;
              reportContent += `MS SQL value: "${discrepancy.msValue}", `;
              reportContent += `MySQL value: "${discrepancy.mysqlValue}"\n`;
            }
          });
        }
      });
    }
    
    await fs.writeFile(reportPath, reportContent);
    logger.info(`Migration report generated: ${reportPath}`);
    
    // Generate CSV files for easier analysis
    if (validationFailures.length > 0) {
      const csvPath = path.join(reportDir, `validation-failures-${timestamp}.csv`);
      let csvContent = 'Order ID,Discrepancy Type,Field,MS SQL Value,MySQL Value,Error\n';
      
      validationFailures.forEach(failure => {
        if (failure.discrepancies && failure.discrepancies.length > 0) {
          failure.discrepancies.forEach(discrepancy => {
            csvContent += `${failure.orderId},`;
            csvContent += `${discrepancy.type},`;
            csvContent += `${discrepancy.field || ''},`;
            csvContent += `"${discrepancy.msValue || ''}",`;
            csvContent += `"${discrepancy.mysqlValue || ''}",`;
            csvContent += `"${discrepancy.error || ''}"\n`;
          });
        } else {
          csvContent += `${failure.orderId},unknown,,,,"No specific discrepancies reported"\n`;
        }
      });
      
      await fs.writeFile(csvPath, csvContent);
      logger.info(`Validation failures CSV generated: ${csvPath}`);
    }
    
    return { reportPath };
  } catch (error) {
    logger.error('Error generating migration report:', error);
    return { error: 'Failed to generate report' };
  }
}

module.exports = {
  generateMigrationReport
}; 