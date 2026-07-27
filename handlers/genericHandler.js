const apiService = require('../services/locationService');
const logger = require('../utils/logger');
const codec8Parser = require('../services/codec8Parser');

module.exports.process = async (socket, buf, hex) => {

    try {

        /**
         * ==================================================
         * LOGIN IMEI
         * ==================================================
         */
        if (!socket.deviceImei) {

            if (buf.length < 4) {
                logger.warn('Packet login terlalu pendek');
                return;
            }

            const length = buf.readUInt16BE(0);

            if (buf.length < (2 + length)) {
                logger.warn('Packet login belum lengkap');
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
         * ==================================================
         * AVL DATA
         * ==================================================
         */

        logger.info('======================================');
        logger.info(`AVL DATA dari ${socket.deviceImei}`);

        if (buf.length < 10) {
            logger.warn('Packet AVL terlalu pendek');
            return;
        }

        const preamble = buf.readUInt32BE(0);
        const dataLength = buf.readUInt32BE(4);
        const codecId = buf.readUInt8(8);
        const recordCount = buf.readUInt8(9);

        logger.info(`Preamble     : ${preamble}`);
        logger.info(`Data Length  : ${dataLength}`);
        logger.info(`Codec ID     : ${codecId}`);
        logger.info(`Record Count : ${recordCount}`);

        if (preamble !== 0) {

            logger.warn('Preamble tidak valid');

            return;

        }

        if (codecId !== 0x08) {

            logger.warn(`Codec ${codecId} belum didukung`);

            return;

        }

        /**
         * ==================================================
         * PARSE AVL
         * ==================================================
         */

        const records = codec8Parser.parse(buf);

        if (!records || records.length === 0) {

            logger.warn('Tidak ada record yang berhasil diparse.');

            return;

        }

        logger.info(`Total Record Parsed : ${records.length}`);

        /**
         * ==================================================
         * ACK KE GPS
         * ==================================================
         */

        const ack = Buffer.alloc(4);

        ack.writeUInt32BE(recordCount, 0);

        socket.write(ack);

        logger.info(`ACK AVL (${recordCount}) dikirim`);

        /**
         * ==================================================
         * BUILD PAYLOAD
         * ==================================================
         */

        const payload = {

            imei: socket.deviceImei,

            records: records.map(record => ({

                latitude: record.latitude,

                longitude: record.longitude,

                altitude: record.altitude,

                speed: record.speed,

                course: record.angle,

                satellite: record.satellites,

                priority: record.priority,

                event_id: record.eventId,

                position_time: new Date(record.timestamp).toISOString(),

                battery: record.io?.[67]
                    ? record.io[67] / 1000
                    : null,

                voltage: record.io?.[66]
                    ? record.io[66] / 1000
                    : null,

                gsm_signal: record.io?.[21] ?? null,

                ignition: (record.io?.[239] ?? 0) === 1,

                attributes: record.io ?? {}

            }))

        };

        /**
         * ==================================================
         * POST KE LARAVEL
         * ==================================================
         */

        try {
            // baru
            console.log("=========== PAYLOAD ===========");
            console.log(JSON.stringify(payload, null, 2));
            console.log("===============================");

            const result = await apiService.postPosition(payload);

            if (result) {

                logger.info(
                    `Berhasil kirim ${records.length} record ke Laravel`
                );

            } else {

                logger.warn(
                    `Gagal kirim data ${socket.deviceImei} ke Laravel`
                );

            }

        } catch (err) {

            logger.error('Laravel API Error');

            logger.error(err);

        }

    } catch (err) {

        logger.error('Handler Error');

        logger.error(err);

    }

};
