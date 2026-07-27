// module.exports.process = async (socket, buf, hex) => {
//     console.log("Unknown device format:", hex);
//     return 'OK';
// };

// const logger = require('../utils/logger');

// module.exports.process = async (socket, buf, hex) => {
//   try {
//     // 2 byte pertama = length prefix
//     const lengthByte = buf.readUInt16BE(0);
//     logger.info('TextImei: length prefix =', lengthByte);

//     // ambil sisa buffer sesuai length, convert ke ASCII
//     const imei = buf.slice(2, 2 + lengthByte).toString('ascii');
//     logger.info('TextImei: IMEI terdeteksi =', imei);

//     // simpen ke socket, dipakai kalau device ini lanjut kirim data lain
//     socket.deviceImei = imei;

//     // banyak device format ini expect balasan simple, coba echo "OK" dulu
//     // (perlu disesuaikan lagi kalau device masih nolak/disconnect)
//     socket.write(Buffer.from('OK\r\n'));
//     logger.info('TextImei: ACK "OK" terkirim');

//   } catch (err) {
//     logger.error('TextImei handler error', err);
//   }
// };

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
