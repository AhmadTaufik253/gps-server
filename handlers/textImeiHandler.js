const logger = require('../utils/logger');

module.exports.process = async (socket, buf, hex) => {
  try {
    logger.info('========== TEXT IMEI LOGIN ==========');
    logger.info('FULL HEX :', hex);
    logger.info('FULL LENGTH :', buf.length, 'bytes');

    // Ambil panjang IMEI
    const lengthByte = buf.readUInt16BE(0);

    logger.info('Length Prefix :', lengthByte);

    // Validasi sederhana
    if (lengthByte <= 0 || lengthByte > 20) {
      logger.warn('Length IMEI tidak valid');
      return;
    }

    // Ambil IMEI
    const imei = buf.slice(2, 2 + lengthByte).toString('ascii');

    logger.info('IMEI :', imei);

    socket.deviceImei = imei;

    /**
     * Kalau ada sisa packet setelah IMEI
     */
    const remaining = buf.slice(2 + lengthByte);

    if (remaining.length > 0) {

      logger.info('===== EXTRA DATA =====');

      logger.info(
        'HEX   :',
        remaining.toString('hex')
      );

      logger.info(
        'ASCII :',
        remaining
          .toString('ascii')
          .replace(/[^\x20-\x7E]/g, '.')
      );

      /**
       * Nanti di sini kita parsing GPS / Heartbeat
       */
      socket.lastRemainingPacket = remaining;
    }

    /**
     * Simpan ke socket
     */
    socket.device = {
      imei,
      connectedAt: new Date(),
      ip: socket.remoteAddress,
      port: socket.remotePort
    };

    /**
     * ACK
     *
     * Sementara kirim SATU ACK saja.
     */
    socket.write(Buffer.from('OK'));

    logger.info(`ACK sent to ${imei}`);

  } catch (err) {

    logger.error('TextImei handler error', err);

  }
};