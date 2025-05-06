# Order Migration Tool (VC to Plum)

A Node.js application for migrating order data from MS SQL Server to MySQL with validation and reporting.

## Features

- Connects to both MS SQL Server and MySQL databases
- Fetches orders and related data from MS SQL
- Transforms data to match MySQL schema
- Inserts transformed data into MySQL
- Validates migrated data for consistency
- Generates detailed migration reports
- Processes orders in configurable batches
- Handles gift voucher details
- Maintains transaction integrity
- Comprehensive logging system

## Requirements

- Node.js (v14+)
- MS SQL Server
- MySQL Server

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Configure the environment variables in `.env` file:

```
# MS SQL Configuration
MSSQL_SERVER=localhost
MSSQL_DATABASE=source_database
MSSQL_USER=sa
MSSQL_PASSWORD=your_password
MSSQL_PORT=1433

# MySQL Configuration
MYSQL_HOST=localhost
MYSQL_DATABASE=destination_database
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_PORT=3306

# Store ID to filter orders by
STORE_ID=MTB

# Batch size for processing
BATCH_SIZE=100

# Logging configuration
LOG_LEVEL=info
```

## Usage

To start the migration process:

```bash
npm start
```

This will:
1. Connect to both databases
2. Fetch orders from MS SQL
3. Transform and insert them into MySQL
4. Validate the data integrity between systems
5. Generate a detailed report in the `/reports` directory
6. Log all activities to console and log files

## Structure

- `index.js`: Main entry point, coordinates the migration process
- `db/`
  - `connection.js`: Database connection configurations
  - `mssql.js`: Functions to retrieve data from MS SQL
  - `mysql.js`: Functions to insert data into MySQL
- `utils/`
  - `transformer.js`: Transforms MS SQL data to MySQL format
  - `report.js`: Generates migration reports
  - `logger.js`: Centralized logging system
- `reports/` (created during runtime)
  - Contains migration reports and validation details
- `logs/` (created during runtime)
  - Contains application logs at different levels

## Logging System

The application uses Winston for logging with the following features:
- Console logging with color formatting for development
- File-based logging for production use and troubleshooting
- Different log levels (error, warn, info, debug)
- Separate log files for errors and combined logs
- Automatic exception and rejection handling
- Configurable log level via environment variable

Log files are stored in the `logs/` directory:
- `combined.log`: All log messages
- `error.log`: Error-level messages only
- `exceptions.log`: Uncaught exceptions
- `rejections.log`: Unhandled promise rejections

## Data Validation

After inserting data into MySQL, the tool validates the migration by:
1. Fetching the data back from MySQL
2. Comparing key fields with the original MS SQL data
3. Identifying and reporting any discrepancies
4. Generating detailed validation failure reports

This validation ensures data integrity between the source and destination systems.

## Reports

The tool generates two types of reports:
1. **Text Report** - Includes a summary of the migration and details of any failures
2. **CSV Report** - For validation failures, easier to analyze in a spreadsheet

Reports are stored in the `reports/` directory with timestamps for easy identification.

## Database Schema Mapping

### MS SQL Tables
- `CustomerOrder`: Main order information
- `OrderLineItem`: Order products
- `OrderShipment`: Shipment information
- `OrderShipmentItem`: Shipment item details
- `OrderAddress`: Shipping addresses
- `OrderPaymentIn`: Payment information
- `OrderVoucherDetails`: Gift voucher details

### MySQL Tables
- `order`: Main order information (70+ columns including customer details, payment details, shipping details)
- `order_product`: Order products (45+ columns covering product details, delivery info, pricing)
- `order_product_data`: Additional product information (key-value pairs for product metadata)
- `order_total`: Order totals (different total types like subtotal, tax, shipping, etc.)
- `egift_voucher_details`: Gift voucher details (voucher codes, pins, validity dates)

### Data Transformation

The tool handles complex transformations including:
- Converting order status codes between systems
- Parsing payment information strings
- Formatting address data
- Handling currency conversions
- Managing voucher codes and pins
- Setting appropriate defaults for required fields

## License

ISC 