import { Sequelize } from 'sequelize';
import { logger } from './logger';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'testflow',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_SSL = 'false',
  NODE_ENV = 'development',
} = process.env;

export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: DB_HOST,
  port: parseInt(DB_PORT, 10),
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  logging: NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  dialectOptions: {
    ssl: DB_SSL === 'true'
      ? { require: true, rejectUnauthorized: false }
      : false,
  },
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true, // soft deletes
  },
});

export const connectDatabase = async (): Promise<void> => {
  await sequelize.authenticate();
  if (NODE_ENV !== 'production') {
    await sequelize.sync({ alter: true });
    logger.info('📦 Database synced (development mode)');
  }
};

export default sequelize;
