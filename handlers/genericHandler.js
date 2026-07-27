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
const codec8Parser = require('../services/codec8Parser');

module.exports.process = async (socket, buf, hex) => {
  try {

    /**
     * ============================
     * LOGIN IMEI
     * ============================
     */
    if (!socket.deviceImei) {

      if (buf.length < 4) {
        logger.warn('Packet login terlalu pendek');
        return;
      }

      const length = buf.readUInt16BE(0);

      if (buf.length < (2 + length)) {
        logger.warn('Packet login tidak lengkap');
        return;
      }

      const imei = buf.slice(2, 2 + length).toString('ascii');

      if (!/^\d{10,17}$/.test(imei)) {
        logger.warn(`IMEI tidak valid : ${imei}`);

        socket.write(Buffer.from([0x00]));

        return;
      }

      socket.deviceImei = imei;

      logger.info(`Login sukses : ${imei}`);

      // ACK Login
      socket.write(Buffer.from([0x01]));

      return;
    }

    /**
     * ============================
     * AVL DATA
     * ============================
     */

    logger.info('======================================');
    logger.info(`AVL DATA dari ${socket.deviceImei}`);

    const preamble = buf.readUInt32BE(0);
    const dataLength = buf.readUInt32BE(4);
    const codecId = buf.readUInt8(8);
    const recordCount = buf.readUInt8(9);

    logger.info(`Preamble     : ${preamble}`);
    logger.info(`Data Length  : ${dataLength}`);
    logger.info(`Codec ID     : ${codecId}`);
    logger.info(`Record Count : ${recordCount}`);

    // Parse AVL
    const records = codec8Parser.parse(buf);

    logger.info(`Total Record Parsed : ${records.length}`);

    records.forEach((record, index) => {

      logger.info(`========== RECORD ${index + 1} ==========`);

      logger.info(record);

      /**
       * TODO
       * Simpan ke database
       */
      // await gpsRepository.insert(record);

    });

    /**
     * ACK AVL
     */
    const ack = Buffer.alloc(4);

    ack.writeUInt32BE(recordCount, 0);

    socket.write(ack);

    logger.info(`ACK AVL (${recordCount}) dikirim`);

  } catch (err) {

    logger.error(err);

  }
};
