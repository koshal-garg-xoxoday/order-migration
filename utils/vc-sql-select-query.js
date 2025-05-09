const getOrdersSql = function(limit, offset, storeId){
    return `select top ${limit} * from customerorder 
    order by createddate desc
    where storeid = '${storeId}'
    offset ${offset} rows`;
}

const getAddressSql = function(orderIds, shipmentIds, paymentIds){
    if(orderIds){
        return `select * from orderaddress where customerorderid in (${orderIds})`;
    }
    if(shipmentIds){
        return `select * from orderaddress where shipmentid in (${shipmentIds})`;
    }
    if(paymentIds){
        return `select * from orderaddress where paymentid in (${paymentIds})`;
    }
}

const getShipmentSql = function(orderIds){
    return `select * from ordershipment where customerorderid in (${orderIds})`;
}

const getOrderLineItemSql = function(orderIds){
    return `select * from orderlineitem where customerorderid in (${orderIds})`;
}

const getOrderPaymentInSql = function(orderIds){
    return `select * from orderpaymentin where customerorderid in (${orderIds})`;
}

const getOrderVoucherDetailsSql = function(orderIds){
    return `select shorttextvalue from orderdynamicobjectvalue 
    join ordershipment on ordershipment.id = orderdynamicobjectvalue.shipmentid
    join customerorder on customerorder.customerorderid = ordershipment.customerorderid
    where customerorder.customerorderid in (${orderIds}) and orderdynamicobjectvalue.name = 'ResponseMeta'`;
}

const getUserInputMetaSql = function(orderIds){
    return `select shorttextvalue from orderdynamicobjectvalue 
    join customerorder on customerorder.customerorderid = orderdynamicobjectvalue.customerorderid
    join orderlineitem on orderlineitem.customerorderid = customerorder.customerorderid
    where customerorder.customerorderid in (${orderIds}) and orderdynamicobjectvalue.name = 'UserInputMeta'`;
}

const getOrderDynamicObjectValueSql = function(orderIds){
    return `select * from orderdynamicobjectvalue where customerorderid in (${orderIds})`;
}

const getOrderShipmentItemSql = function(shipmentIds){
    return `select * from ordershipmentitem 
            where shipmentid in (${shipmentIds})`;
}

module.exports = {
    getOrdersSql,
    getAddressSql,
    getShipmentSql,
    getOrderLineItemSql,
    getOrderPaymentInSql,
    getOrderVoucherDetailsSql,
    getOrderDynamicObjectValueSql,
    getUserInputMetaSql,
    getOrderShipmentItemSql
}