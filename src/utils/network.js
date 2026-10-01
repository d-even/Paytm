const os = require('os');
const config = require('../config');

// First non-internal IPv4 address — what a phone on the same Wi-Fi uses to reach this laptop.
function lanIp() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}

function publicBaseUrl() {
  return config.publicBaseUrl || `http://${lanIp()}:${config.port}`;
}

module.exports = { lanIp, publicBaseUrl };
