import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// Console format for development
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level}]: ${message}\n${stack}`
      : `${timestamp} [${level}]: ${message}`;
  })
);

// JSON format for production / file logs
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  }),
];

if (process.env.LOG_SHIP_URL) {
  transports.push(
    new winston.transports.Http({
      host: new URL(process.env.LOG_SHIP_URL).hostname,
      port: Number(new URL(process.env.LOG_SHIP_URL).port || (process.env.LOG_SHIP_URL.startsWith('https') ? 443 : 80)),
      path: new URL(process.env.LOG_SHIP_URL).pathname || '/',
      ssl: process.env.LOG_SHIP_URL.startsWith('https'),
      format: prodFormat,
    })
  );
}

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      dirname: path.join(LOG_DIR, 'combined'),
      filename: 'testflow-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat,
    }),
    new DailyRotateFile({
      dirname: path.join(LOG_DIR, 'errors'),
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: prodFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logging
export const httpStream = {
  write: (message: string) => logger.http(message.trim()),
};
