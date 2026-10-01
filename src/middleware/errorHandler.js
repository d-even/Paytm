const log = require('../utils/logger');

function notFound(req, res) {
  res.status(404).json({ error: `no route for ${req.method} ${req.path}` });
}

// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
  if (status >= 500) log.error('api', `${req.method} ${req.path}: ${err.stack || err.message}`);
  res.status(status).json({ error: status >= 500 ? 'internal error' : err.message });
}

module.exports = { notFound, errorHandler };
