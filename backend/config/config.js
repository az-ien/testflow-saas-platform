require('dotenv').config();

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'testflow',
  DB_TEST_NAME,
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_SSL = 'false',
} = process.env;

const baseConfig = {
  username: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  port: Number.parseInt(DB_PORT, 10),
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: DB_SSL === 'true'
      ? { require: true, rejectUnauthorized: false }
      : false,
  },
};

module.exports = {
  development: {
    ...baseConfig,
    database: DB_NAME,
  },
  test: {
    ...baseConfig,
    database: DB_TEST_NAME || `${DB_NAME}_test`,
  },
  production: {
    ...baseConfig,
    database: DB_NAME,
  },
};
