import * as winston from 'winston';
import { localStorage } from './utils';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    logger_name: 'product-accommodation-saleable',
    get timestamp() {
      return new Date().toISOString();
    },
    get correlationId() {
      return localStorage.getStore();
    }
  },

  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    })],
});

export default logger;
