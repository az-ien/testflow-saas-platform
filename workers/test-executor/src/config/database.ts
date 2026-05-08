import { Sequelize } from 'sequelize';
import { logger } from './logger';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'testflow',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_SSL = 'false',
} = process.env;

export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: DB_HOST,
  port: parseInt(DB_PORT, 10),
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  logging: false,
  dialectOptions: {
    ssl: DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
  },
  pool: { max: 5, min: 1, acquire: 30000, idle: 10000 },
});

export const connectDatabase = async (): Promise<void> => {
  await sequelize.authenticate();
  logger.info('Worker DB connected');
};

export default sequelize;
