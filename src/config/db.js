const mongoose = require('mongoose');
const config = require('./index');
const log = require('../utils/logger');

async function connectDB(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    err.message = `could not reach MongoDB at ${uri.replace(/\/\/[^@]*@/, '//***@')} — is it running? (docker compose up -d, or set MONGODB_URI to Atlas). ${err.message}`;
    throw err;
  }
  log.info('db', `MongoDB connected → ${mongoose.connection.name}`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
