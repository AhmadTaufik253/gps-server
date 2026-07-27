const logger = require('../utils/logger');

module.exports.process = async (socket, buf, hex) => {
  try {
    logger.info('========== TEXT IMEI LOGIN ==========');
    logger.info('FULL HEX :', hex);

    if (buf.length < 2) {
      logger.warn('Buffer terlalu pendek');
      return;
    }

    const lengthByte = buf.readUInt16BE(0);

    if (lengthByte <= 0 || lengthByte > 20) {
      logger.warn('Length IMEI tidak valid:', lengthByte);
      socket.write(Buffer.from([0x00])); // reject
      return;
    }

    if (buf.length < 2 + lengthByte) {
      logger.warn('Buffer lebih pendek dari length prefix');
      return;
    }

    const imei = buf.slice(2, 2 + lengthByte).toString('ascii');

    if (!/^\d{10,15}$/.test(imei)) {
      logger.warn('Format IMEI tidak valid:', imei);
      socket.write(Buffer.from([0x00])); // reject
      return;
    }

    logger.info('IMEI :', imei);

    socket.deviceImei = imei;
    socket.device = {
      imei,
      connectedAt: new Date(),
      ip: socket.remoteAddress,
      port: socket.remotePort
    };

    // ACK login gaya Teltonika: 1 byte
    socket.write(Buffer.from([0x01]));
    logger.info(`ACK login (0x01) dikirim ke ${imei}`);

  } catch (err) {
    logger.error('TextImei handler error', err);
  }
};