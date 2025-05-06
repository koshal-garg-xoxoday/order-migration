const path = require('path');
const rTracer = require('cls-rtracer');
const {isPlainObject} = require('is-plain-object');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

require('winston-daily-rotate-file');

/**
 * 1. Please replace "microServiceName" to appropriate micro Service Name.
 * 2. Set the environment.
 * 3. Install cls-rtracer, winston, winston-daily-rotate-file, and is-plain-object npm package
 */

const microServiceName = 'order-migration'; // Set the micro service name
// Set excluded keys for production environment
const excludedKeys = process.env.NODE_ENV === 'production' ? 
    ['clientsecret', 'secret', 'password', 'work_email', 'first_name', 'last_name', 'email', 'userInput', 'emp_id', 'loggedin_email', 'contact1', 'auth_company_encryption_key', 'pwd', 'new_pwd', 'confirmed_pwd', 'old_pwd', 'employee_email', 'employee_alternate_email', 'employee_birthdate', 'employee_first_name', 'employee_middle_name', 'employee_last_name', 'employee_full_name', 'employee_primary_mobile', 'employee_address', 'employee_address2', 'employee_zip_code', 'employee_city', 'employee_state', 'profile_image_dp', 'name', 'user_input', 'em', 'user_email', 'auth_email_id', 'otp', 'resetlink'] 
    : [];

const xoxoFormat = printf((info) => {
    try {
        const rid = rTracer.id();
        let message = deepRegexReplace(info.message);
        message = isPlainObject(message) ? [message] : message;
        let final_message = [];
        for (var i = 0; message && i < message.length; i++) {
            let item = typeof message[i] == 'object' ? JSON.stringify(message[i]) : message[i];
            final_message.push(item);
        }
        final_message = final_message.join(' | ');
        return rid
            ? `${info.timestamp} [${info.service}] ${info.level} [request-id:${rid}]: ${final_message}`
            : `${info.timestamp} [${info.service}] ${info.level} [request-id:0000]: ${final_message}`
    } catch (error) {
        return `${new Date().toISOString()} [${microServiceName}] error [request-id:1111]: LoggerError ${error}`
    }
});

const deepRegexReplace = (value, single_key = '') => {
    try {
        const parsed_value = JSON.parse(value);
        if (typeof parsed_value == 'object') {
            value = parsed_value;
        }
    } catch (e) { }
    try {
        if (typeof value === 'undefined' || typeof excludedKeys === 'undefined') return value || '';
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i = i + 1) {
                value[i] = deepRegexReplace(value[i]);
            }
            return value;
        } else if (isPlainObject(value)) {
            for (let key in value) {
                if (value.hasOwnProperty(key)) {
                    value[key] = deepRegexReplace(value[key], key);
                }
            }
            return value;
        } else {
            if (excludedKeys.includes(single_key.toLowerCase()))
                return '[REDACTED]';
            else
                return value;
        }
    } catch (e) {
        console.error('Logger deepRegexReplace', e);
        return value;
    }
}

const winstonLogger = createLogger({
    format: combine(
        format(info => {
            info.level = info.level.toUpperCase()
            return info;
        })(),
        timestamp(),
        xoxoFormat
    ),
    level: process.env.LOG_LEVEL || 'debug',
    transports: [new (transports.DailyRotateFile)({
        name: "file",
        datePattern: 'YYYY-MM-DD',
        filename: path.join(__dirname, '../logs', `${microServiceName}_%DATE%.log`),
        // zippedArchive: true,
        maxFiles: '5',
        maxSize: '20m',
        timestamp: true
    }),
    new transports.Console({
        format: format.combine(
            format.colorize(),
            xoxoFormat
        )
    })],
    defaultMeta: { service: microServiceName }
});


const wrapper = (original) => {
    return (...args) => {
        var _transformedArgs = []
        args.forEach((arg) => {
            if (typeof arg == "object") {
                if (arg instanceof Error) {
                    _transformedArgs.push(arg.stack);
                } else {
                    _transformedArgs.push(JSON.stringify(arg));
                }
            } else {
                _transformedArgs.push(arg);
            }
        })
        return original(_transformedArgs);
    }
}

winstonLogger.error = wrapper(winstonLogger.error);
winstonLogger.warn = wrapper(winstonLogger.warn);
winstonLogger.info = wrapper(winstonLogger.info);
winstonLogger.debug = wrapper(winstonLogger.debug);

var XoXoLogger = {
    log: function (level, message, ...args) {
        winstonLogger.log(level, message, ...args);
    },
    error: function (message, ...args) {
        winstonLogger.error(message, ...args);
    },
    warn: function (message, ...args) {
        winstonLogger.warn(message, ...args);
    },
    info: function (message, ...args) {
        winstonLogger.info(message, ...args);
    },
    debug: function (message, ...args) {
        winstonLogger.debug(message, ...args);
    }
}

module.exports.logger = XoXoLogger; 