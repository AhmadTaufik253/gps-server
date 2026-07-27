const logger = require('../utils/logger');

module.exports.process = async (socket, buf, hex) => {
  try {
    const lengthByte = buf.readUInt16BE(0);
    const imei = buf.slice(2, 2 + lengthByte).toString('ascii');
    logger.info('TextImei: IMEI terdeteksi =', imei);

    socket.deviceImei = imei;

    // banyak device format ini expect balasan simple "OK" atau echo tertentu
    // kalau device masih disconnect abis ini, kita perlu cari tau format ACK yang bener
    socket.write(Buffer.from('OK\r\n'));
    logger.info('TextImei: ACK dikirim: OK');
  } catch (err) {
    logger.error('TextImei handler error', err);
  }
};