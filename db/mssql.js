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
async function fetchOrders(pool, storeId = 'MTB', limit = 100, offset = 0) {
  try {
    const request = pool.request();
    
    const query = `
      SELECT TOP ${limit}
        co.id,
        co.Number AS ordernumber,
        co.Status,
        co.createddate,
        co.modifieddate,
        co.Sum as orderPrice,
        co.Currency,
        co.customername,
        co.customerid,
        co.storeid,
        oli.productid,
        oli.name,
        oli.quantity,
        oli.Price as itemPrice,
        oli.currency as itemCurrency,
        oli.ImageUrl,
        STRING_AGG(concat(opi.OuterId, ';', opi.Status), ',') AS PaymentOuterIds,
        STRING_AGG(concat(oa.AddressType, ' : ', oa.line1, ' ', oa.Line2, ' ', oa.city, ' ', oa.RegionId, ' ', oa.RegionName, ' ', oa.PostalCode, ' ', oa.CountryCode, ' ', oa.CountryName), ',') as address,
        os.Number as shipmentNumber,
        os.Status as shipmentStatus
      FROM CustomerOrder co
      JOIN OrderLineItem oli ON co.Id = oli.CustomerOrderId
      LEFT OUTER JOIN OrderShipmentItem osi ON osi.LineItemId = oli.Id  
      LEFT OUTER JOIN OrderShipment os ON osi.ShipmentId = os.id
      LEFT OUTER JOIN OrderAddress oa ON oa.shipmentid = os.id
      LEFT OUTER JOIN OrderPaymentIn opi ON co.id = opi.CustomerOrderId
      WHERE co.storeid = @storeId
      GROUP BY co.Number, co.Status, os.Number, co.CreatedDate, co.ModifiedDate,
        co.customername, co.customerid, co.StoreId, oli.ProductId, oli.Name, 
        os.Status, co.id, oli.price, oli.Quantity, co.sum,
        oli.Currency, co.Currency, oli.imageurl
      ORDER BY co.createddate DESC
      OFFSET @offset ROWS
    `;
    
    request.input('storeId', sql.VarChar, storeId);
    request.input('offset', sql.Int, offset);
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    logger.error('Error fetching orders from MS SQL:', error);
    throw error;
  }
}

/**
 * Get gift voucher details for a specific order
 * @param {sql.ConnectionPool} pool - MS SQL Connection Pool
 * @param {string} orderId - Order ID to retrieve vouchers for
 * @returns {Promise<Array>} - Array of voucher records
 */
async function fetchVoucherDetails(pool, orderId) {
  try {
    const request = pool.request();
    
    const query = `
      SELECT 
        OrderId,
        Code as voucherCode,
        Pin as pin,
        Amount as amount,
        ValidityDate as validity,
        ProductId as productId
      FROM OrderVoucherDetails
      WHERE OrderId = @orderId
    `;
    
    request.input('orderId', sql.VarChar, orderId);
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    logger.error('Error fetching voucher details from MS SQL:', error);
    throw error;
  }
}

module.exports = {
  fetchOrders,
  fetchVoucherDetails
}; 