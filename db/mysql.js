require('dotenv').config();
const { logger } = require('../utils/logger');

/**
 * Insert order data into MySQL database
 * @param {Object} connection - MySQL Connection
 * @param {Object} orderData - Transformed order data
 * @returns {Promise<Object>} - Result of insertion
 */
async function insertOrder(connection, orderData) {
  const conn = await connection.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Fields specifically for order table
    const orderFields = [
      'order_id', 'invoice_no', 'invoice_prefix', 'invoice_path', 'store_id', 
      'store_name', 'store_url', 'customer_id', 'new_customer_id', 'customer_group_id',
      'firstname', 'lastname', 'email', 'telephone', 'fax',
      'payment_firstname', 'payment_lastname', 'payment_company', 'payment_company_id',
      'payment_tax_id', 'payment_address_1', 'payment_address_2', 'payment_city',
      'payment_postcode', 'payment_country', 'payment_country_id', 'payment_zone',
      'payment_zone_id', 'payment_address_format', 'payment_method', 'payment_code',
      'shipping_firstname', 'shipping_lastname', 'shipping_contact_no', 'shipping_company',
      'shipping_address_1', 'shipping_address_2', 'shipping_city', 'shipping_postcode',
      'shipping_country', 'shipping_country_id', 'shipping_zone', 'shipping_zone_id',
      'shipping_address_format', 'shipping_method', 'shipping_code', 'comment',
      'total', 'total_product_discount', 'order_status_id', 'delivery_status',
      'mail_delivery_status', 'sms_delivery_status', 'delivery_date', 'affiliate_id',
      'commission', 'language_id', 'currency_id', 'currency_code', 'currency_value',
      'ip', 'forwarded_ip', 'user_agent', 'accept_language', 'date_added',
      'date_modified', 'landline', 'shiping_landline', 'is_order_history_deleted',
      'order_contains', 'vendor_name', 'client_name', 'client_order_id', 'client_order_date',
      'po_number', 'po_item_reference', 'otp_telephone', 'source', 'prefered_date',
      'app', 'client_app_id', 'settled_date'
    ];
    
    // Construct the SQL dynamically
    const placeholders = orderFields.map(() => '?').join(', ');
    const updateStatements = orderFields.map(field => `${field} = VALUES(${field})`).join(', ');
    
    // Create an array of values in the same order as fields
    const orderValues = orderFields.map(field => orderData[field] !== undefined ? orderData[field] : null);
    
    // Insert into order table
    await conn.query(
      `INSERT INTO \`order\` (${orderFields.join(', ')}) 
       VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updateStatements}`,
      orderValues
    );
    
    // Insert order products
    for (const product of orderData.products) {
      // Fields specifically for order_product table
      const productFields = [
        'order_id', 'product_id', 'name', 'model', 'quantity', 'price', 'raw_price',
        'total', 'tax', 'vendor_gst_percent', 'reward', 'receiver_mobile_number',
        'receiver_mobile_code', 'order_product_status', 'order_product_delivery_date',
        'courier_tracking_id', 'other_courier_company', 'delivery_status', 'courier_company',
        'egift_voucher_theme_id', 'customize_voucher', 'physical_voucher_sl_no',
        'alternative_email', 'cancel_reason', 'cancel_user_id', 'product_discount',
        'total_after_discount', 'review_cancel', 'frogo_user_type_id', 'prefered_date',
        'category_id', 'changes_message', 'city_id', 'address', 'address_id',
        'package_id', 'package_info', 'orderImage', 'loyalty_name', 'loyalty_conversion',
        'loyalty_denomination', 'reference_key', 'reference_value', 'details', 'currency_code'
      ];
      
      // Create complete product object with order_id
      const productData = {
        order_id: orderData.order_id,
        ...product
      };
      
      // Construct the SQL dynamically
      const productPlaceholders = productFields.map(() => '?').join(', ');
      const productUpdateStatements = productFields.map(field => `${field} = VALUES(${field})`).join(', ');
      
      // Create an array of values in the same order as fields
      const productValues = productFields.map(field => productData[field] !== undefined ? productData[field] : null);
      
      // Insert into order_product table
      const [productResult] = await conn.query(
        `INSERT INTO order_product (${productFields.join(', ')}) 
         VALUES (${productPlaceholders})
         ON DUPLICATE KEY UPDATE ${productUpdateStatements}`,
        productValues
      );
      
      // Get the inserted product ID
      const order_product_id = productResult.insertId || product.order_product_id;
      
      // Insert additional product data if available
      if (product.image_url) {
        await conn.query(
          `INSERT INTO order_product_data (
            order_product_id,
            \`key\`,
            value
          ) VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            value = VALUES(value)`,
          [
            order_product_id,
            'image_url',
            product.image_url
          ]
        );
      }
    }
    
    // Insert order totals
    for (const total of orderData.totals) {
      // Fields specifically for order_total table
      const totalFields = [
        'order_id', 'code', 'title', 'text', 'value', 'sort_order', 'type'
      ];
      
      // Create complete total object with order_id
      const totalData = {
        order_id: orderData.order_id,
        ...total
      };
      
      // Construct the SQL dynamically
      const totalPlaceholders = totalFields.map(() => '?').join(', ');
      const totalUpdateStatements = totalFields.map(field => `${field} = VALUES(${field})`).join(', ');
      
      // Create an array of values in the same order as fields
      const totalValues = totalFields.map(field => totalData[field] !== undefined ? totalData[field] : null);
      
      // Insert into order_total table
      await conn.query(
        `INSERT INTO order_total (${totalFields.join(', ')}) 
         VALUES (${totalPlaceholders})
         ON DUPLICATE KEY UPDATE ${totalUpdateStatements}`,
        totalValues
      );
    }
    
    // Insert vouchers if available
    if (orderData.vouchers && orderData.vouchers.length > 0) {
      for (const voucher of orderData.vouchers) {
        // Fields specifically for egift_voucher_details table
        const voucherFields = [
          'order_id', 'validity_date', 'amount', 'product_id', 'status',
          'salt', 'code', 'pin', 'date_added', 'date_modified',
          'transfer_voucher_request_id', 'special_case_id'
        ];
        
        // Create complete voucher object with order_id
        const voucherData = {
          order_id: orderData.order_id,
          code: voucher.voucher_code,
          ...voucher
        };
        
        // Construct the SQL dynamically
        const voucherPlaceholders = voucherFields.map(() => '?').join(', ');
        const voucherUpdateStatements = voucherFields.map(field => `${field} = VALUES(${field})`).join(', ');
        
        // Create an array of values in the same order as fields
        const voucherValues = voucherFields.map(field => voucherData[field] !== undefined ? voucherData[field] : null);
        
        // Insert into egift_voucher_details table
        await conn.query(
          `INSERT INTO egift_voucher_details (${voucherFields.join(', ')}) 
           VALUES (${voucherPlaceholders})
           ON DUPLICATE KEY UPDATE ${voucherUpdateStatements}`,
          voucherValues
        );
      }
    }
    
    await conn.commit();
    return { success: true, orderId: orderData.order_id };
  } catch (error) {
    await conn.rollback();
    logger.error('Error inserting order data into MySQL:', error);
    return { success: false, error: error.message, orderId: orderData.order_id };
  } finally {
    conn.release();
  }
}

module.exports = {
  insertOrder
}; 