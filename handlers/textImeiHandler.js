const logger = require('../utils/logger');

module.exports.process = async (socket, buf, hex) => {
  try {
    if (buf.length < 2) return;

    const lengthByte = buf.readUInt16BE(0);

    // Heartbeat: length prefix = 0, tanpa payload
    if (lengthByte === 0) {
      logger.info(`Heartbeat dari ${socket.deviceImei || 'unknown'}`);
      socket.write(Buffer.from([0x01])); // ack heartbeat, konsisten dgn ack login
      return;
    }

    // Login IMEI: hanya diproses kalau belum ada IMEI di socket ini
    if (!socket.deviceImei) {
      if (buf.length < 2 + lengthByte) {
        logger.warn('Buffer lebih pendek dari length prefix');
        return;
      }

      const imei = buf.slice(2, 2 + lengthByte).toString('ascii');

      if (!/^\d{10,15}$/.test(imei)) {
        logger.warn('Format IMEI tidak valid:', imei);
        socket.write(Buffer.from([0x00]));
        return;
      }

      socket.deviceImei = imei;
      socket.device = {
        imei,
        connectedAt: new Date(),
        ip: socket.remoteAddress,
        port: socket.remotePort
      };

      socket.write(Buffer.from([0x01]));
      logger.info(`Login sukses, IMEI = ${imei}`);
      return;
    }

    // Kalau sudah login tapi length > 0, ini kemungkinan paket data GPS
    logger.info('Kemungkinan paket data GPS (HEX):', hex);
    // TODO: parsing GPS data di sini, format masih perlu direverse-engineer

  } catch (err) {
    logger.error('TextImei handler error', err);
  }
};