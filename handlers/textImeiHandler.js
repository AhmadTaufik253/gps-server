const logger = require('../utils/logger');

module.exports.process = async (socket, buf, hex) => {
  try {
    logger.info('TextImei FULL HEX:', hex);
    logger.info('TextImei FULL LENGTH:', buf.length, 'bytes');

    const lengthByte = buf.readUInt16BE(0);
    logger.info('TextImei length prefix:', lengthByte);

    const imei = buf.slice(2, 2 + lengthByte).toString('ascii');
    logger.info('TextImei: IMEI terdeteksi =', imei);

    const remaining = buf.slice(2 + lengthByte);
    if (remaining.length > 0) {
      logger.info('TextImei: SISA BYTES setelah IMEI (hex):', remaining.toString('hex'));
      logger.info('TextImei: SISA BYTES setelah IMEI (ascii):', remaining.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
    }

    socket.deviceImei = imei;
    socket.write(Buffer.from('OK\r\n'));
    logger.info('TextImei: ACK dikirim: OK\\r\\n');
  } catch (err) {
    logger.error('TextImei handler error', err);
  }
};

