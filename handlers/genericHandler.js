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
    if (buf.length < 2) {
      logger.warn(`Buffer terlalu pendek: length=${buf.length}, hex=${hex}`);
      return;
    }

    const lengthByte = buf.readUInt16BE(0);

    // Heartbeat: length prefix = 0
    if (lengthByte === 0) {
      logger.info(
        `Heartbeat dari ${socket.deviceImei || 'unknown'} | buf.length=${buf.length} | hex=${hex}`
      );
      socket.write(Buffer.from([0x01]));
      return;
    }

    // Login IMEI: hanya diproses kalau socket ini belum punya IMEI
    if (!socket.deviceImei) {
      if (buf.length < 2 + lengthByte) {
        logger.warn(
          `Buffer lebih pendek dari length prefix. expected=${2 + lengthByte}, actual=${buf.length}, hex=${hex}`
        );
        return;
      }

      const imei = buf.slice(2, 2 + lengthByte).toString('ascii');

      if (!/^\d{10,15}$/.test(imei)) {
        logger.warn(`Format IMEI tidak valid: "${imei}", hex=${hex}`);
        socket.write(Buffer.from([0x00])); // reject
        return;
      }

      socket.deviceImei = imei;
      socket.device = {
        imei,
        connectedAt: new Date(),
        ip: socket.remoteAddress,
        port: socket.remotePort,
      };

      socket.write(Buffer.from([0x01])); // accept
      logger.info(`Login sukses, IMEI = ${imei}`);
      return;
    }

    // Sudah login, length > 0 → kemungkinan paket data GPS
    logger.info(
      `Kemungkinan paket DATA dari ${socket.deviceImei} | buf.length=${buf.length} | lengthPrefix=${lengthByte} | hex=${hex}`
    );

    const payload = buf.slice(2, 2 + lengthByte);
    logger.info(
      `  payload ascii: ${payload.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}`
    );

    // TODO: parsing struktur data GPS di sini setelah kita tau formatnya
    // dari sample hex yang bakal muncul

  } catch (err) {
    logger.error('TextImei handler error', err);
  }
};
