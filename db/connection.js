require('dotenv').config();
const sql = require('mssql');
const mysql = require('mysql2/promise');
const { logger } = require('../utils/logger');

// MS SQL Configuration
const mssqlConfig = {
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  port: parseInt(process.env.MSSQL_PORT, 10),
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// MySQL Configuration
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  port: parseInt(process.env.MYSQL_PORT, 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Connect to MS SQL
async function connectToMsSQL() {
  try {
    const pool = await sql.connect(mssqlConfig);
    logger.info('Connected to MS SQL Server successfully');
    return pool;
  } catch (err) {
    logger.error('Failed to connect to MS SQL Server:', err);
    throw err;
  }
}

// Connect to MySQL
async function connectToMySQL() {
  try {
    const pool = await mysql.createPool(mysqlConfig);
    logger.info('Connected to MySQL Server successfully');
    return pool;
  } catch (err) {
    logger.error('Failed to connect to MySQL Server:', err);
    throw err;
  }
}

module.exports = {
  connectToMsSQL,
  connectToMySQL,
}; 