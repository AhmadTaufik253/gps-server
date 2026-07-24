const locationService = require('../services/locationService');
const logger = require('../utils/logger');

function hexToInt(hex) {
  return parseInt(hex, 16);
}
function decodeLatLng(hex) {
  // many VT100 variants store lat/lng as hex int scaled by 1e6
  return parseInt(hex, 16) / 1000000;
}

module.exports.process = async (socket, buf, hex) => {
  try {
    // HEX mode starting 6767
    if (hex.startsWith('6767')) {
      const proto = hex.substring(4,6);
      if (proto === '01') { // login
        logger.info('VT100 login packet (hex)');
        socket.write(Buffer.from('67670100', 'hex'));
        return;
      }
      if (proto === '10' || proto === '11') { // gps or heartbeat
        // rough parse: lat at pos 8..15, lng 16..23, speed 24..25
        const lat = decodeLatLng(hex.substring(8, 16));
        const lng = decodeLatLng(hex.substring(16, 24));
        const speed = hexToInt(hex.substring(24,26));

        // try find imei in ASCII payload fallback:
        let imei = 'unknown';
        const ascii = buf.toString();
        const m = ascii.match(/(\d{10,16})/);
        if (m) imei = m[1];

        await locationService.postPosition({
          imei, lat, lng, speed, course: 0, device_time: null, raw: hex
        });
        return;
      }
    }

    // ASCII mode: e.g. "356823045678901,2403031500,A,-6.229728,106.689732,0.00,0"
    try {
      const ascii = buf.toString().trim();
      if (ascii.includes(',')) {
        logger.debug('VT100 ASCII payload:', ascii);
        const parts = ascii.split(',');
        // many ascii formats: [imei, date/time, valid, lat, lng, speed, course]
        let imei = parts[0];
        let lat = parseFloat(parts[3] || parts[1]);
        let lng = parseFloat(parts[4] || parts[2]);
        let speed = parseFloat(parts[5] || 0);
        await locationService.postPosition({
          imei, lat, lng, speed, course: 0, device_time: null, raw: ascii
        });
        return;
      }
    } catch (e) {}

    logger.debug('VT100: unknown packet');
  } catch (err) {
    logger.error('VT100 handler error', err);
  }
};
