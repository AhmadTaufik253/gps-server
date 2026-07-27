// module.exports.process = async (socket, buf, hex) => {
//     console.log("Unknown device format:", hex);
//     return 'OK';
// };

const logger = require('../utils/logger');

module.exports.process = async (socket, buf, hex) => {
  try {
    // 2 byte pertama = length prefix
    const lengthByte = buf.readUInt16BE(0);
    logger.info('TextImei: length prefix =', lengthByte);

    // ambil sisa buffer sesuai length, convert ke ASCII
    const imei = buf.slice(2, 2 + lengthByte).toString('ascii');
    logger.info('TextImei: IMEI terdeteksi =', imei);

    // simpen ke socket, dipakai kalau device ini lanjut kirim data lain
    socket.deviceImei = imei;

    // banyak device format ini expect balasan simple, coba echo "OK" dulu
    // (perlu disesuaikan lagi kalau device masih nolak/disconnect)
    socket.write(Buffer.from('OK\r\n'));
    logger.info('TextImei: ACK "OK" terkirim');

  } catch (err) {
    logger.error('TextImei handler error', err);
  }
};
