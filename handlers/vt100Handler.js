const locationService = require('../services/locationService');
const logger = require('../utils/logger');

// Hitung checksum: jumlah semua byte sebelum checksum, ambil byte terendah, format 2-digit hex
function calcChecksum(strWithoutChecksum) {
  let sum = 0;
  for (let i = 0; i < strWithoutChecksum.length; i++) {
    sum += strWithoutChecksum.charCodeAt(i);
  }
  return (sum & 0xff).toString(16).padStart(2, '0').toUpperCase();
}

function parseDateTime(str){

    const year = 2000 + Number(str.substring(0,2));

    const month = Number(str.substring(2,4))-1;

    const day = Number(str.substring(4,6));

    const hour = Number(str.substring(6,8));

    const minute = Number(str.substring(8,10));

    const second = Number(str.substring(10,12));

    return new Date(Date.UTC(
        year,
        month,
        day,
        hour,
        minute,
        second
    ));

}

function parsePacket(raw) {
  // raw contoh: "&&A147,021104023195429,000,0,,180106093046,A,22.646430,114.065730,8,0.9,54,86,76,326781,460|0|27B3|0EA7,27,0000000F,02,01,04E2|018C|01C8|0000,1,0104B0,01013D|02813546XX"
  const header = raw.slice(0, 2); // && atau $$
  const packNo = raw[2];
  const rest = raw.slice(3);

  const firstComma = rest.indexOf(',');
  const packLen = parseInt(rest.slice(0, firstComma), 10);

  // 2 karakter terakhir dari packet adalah checksum hex
  const bodyAndChecksum = rest.slice(firstComma + 1);
  const checksum = bodyAndChecksum.slice(-2);
  const body = bodyAndChecksum.slice(0, -2);

  const expectedChecksum = calcChecksum(raw.slice(0, -2));

  if (expectedChecksum !== checksum) {
      logger.warn(
          `Checksum mismatch. packet=${checksum} expected=${expectedChecksum}`
      );
  }

  const fields = body.split(',');
  if (fields.length < 20) {
    throw new Error(
        `Invalid VT100 packet. Field count=${fields.length}`
    );
  }

  const [
    id, cmd, almCode, almData, dateTime, fixFlag,
    latitude, longitude, satQty, hdop, speed, course,
    altitude, odometer, cellInfo, csq, systemSta,
    inSta, outSta, voltages, proCode, fuel, temp
  ] = fields;

  const systemStaInt = parseInt(systemSta, 16) || 0;
  const deviceTime = parseDateTime(dateTime);
  return {
    header,
    packNo,
    packLen,
    checksum,
    id,
    cmd,
    almCode,
    // dateTime,
    deviceTime,
    fixFlag: fixFlag === 'A',
    latitude: Number(latitude),
    longitude: Number(longitude),
    satellites: parseInt(satQty, 10) || 0,
    hdop: parseFloat(hdop) || null,
    speed: parseFloat(speed) || 0,
    course: parseFloat(course) || 0,
    altitude: parseFloat(altitude) || 0,
    odometer: parseInt(odometer, 10) || 0,
    csq: parseInt(csq, 10) || 0,
    // bit2 GPS valid, bit3 ext power, bit5 stop/move (0=move,1=stop) - sesuaikan kalau perlu bit lain
    gpsValid: (systemStaInt & (1 << 2)) !== 0,
    extPowerConnected: (systemStaInt & (1 << 3)) !== 0,
    isStopped: (systemStaInt & (1 << 5)) !== 0,
    raw,
  };
}

module.exports.process = async (socket, buf, hex) => {
  try {
    // --- Packet framing: buffer per-socket, split berdasarkan \r\n ---
    // karena satu TCP 'data' event bisa berisi >1 paket atau paket kepotong
    socket._vt100Buffer = (socket._vt100Buffer || '') + buf.toString('ascii');

    let idx;
    while ((idx = socket._vt100Buffer.indexOf('\r\n')) !== -1) {
      const rawPacket = socket._vt100Buffer.slice(0, idx);
      socket._vt100Buffer = socket._vt100Buffer.slice(idx + 2);

      if (!rawPacket.startsWith('&&')) {
        logger.warn('VT100: paket tidak diawali &&, dilewati:', rawPacket);
        continue;
      }

      logger.info("========== RAW VT100 ==========");
      logger.info(rawPacket);
      logger.info("===============================");

      const parsed = parsePacket(rawPacket);

      logger.info(JSON.stringify(parsed, null, 2));
      logger.info(`Time=${parsed.deviceTime.toISOString()}`);
      logger.info(`GPS=${parsed.latitude},${parsed.longitude}`);
      logger.info(`Sat=${parsed.satellites} Speed=${parsed.speed}`);
      logger.info(`Fix=${parsed.fixFlag}`);
      logger.info(`CSQ=${parsed.csq}`);
      logger.info(`Stopped=${parsed.isStopped}`);
      console.log(parsed);

      logger.info(
        `VT100 dari ${parsed.id} | cmd=${parsed.cmd} | lat=${parsed.latitude}, lon=${parsed.longitude}, speed=${parsed.speed}, course=${parsed.course}`
      );

      socket.deviceImei = parsed.id;

      if (parsed.fixFlag && !isNaN(parsed.latitude) && !isNaN(parsed.longitude)) {
        // await locationService.postPosition({
        //   imei: parsed.id,
        //   lat: parsed.latitude,
        //   lng: parsed.longitude,
        //   speed: parsed.speed,
        //   course: parsed.course,
        //   altitude: parsed.altitude,
        //   satellites: parsed.satellites,
        //   odometer: parsed.odometer,
        //   ignition: null, // cek bit yang sesuai di systemSta kalau device kirim info ini
        //   device_time: parsed.dateTime,
        //   raw: parsed.raw,
        // });
        try {
          await locationService.postPosition({
            imei: parsed.id,
            records: [
                {
                    latitude: parsed.latitude,
                    longitude: parsed.longitude,
                    altitude: parsed.altitude,
                    speed: parsed.speed,
                    course: parsed.course,
                    satellite: parsed.satellites,
                    priority: 0,
                    event_id: 0,
                    position_time: parsed.deviceTime.toISOString(),
                    battery: null,
                    voltage: null,
                    gsm_signal: parsed.csq,
                    ignition: !parsed.isStopped,
                    attributes: {
                        hdop: parsed.hdop,
                        odometer: parsed.odometer,
                        raw: parsed.raw
                    }
                }
            ]
          });
          logger.info("Position sent");
        } catch(err){
          logger.error(err);
        }
      } else {
        logger.warn(`VT100: fix GPS belum valid dari ${parsed.id}, data posisi dilewati`);
      }

      // --- ACK wajib untuk cmd 010 (data) dan 020 (compressed data) ---
      if (parsed.cmd === '010' || parsed.cmd === '020') {
        const cmdData = `${parsed.cmd},1`;

        // const bodyWithoutChecksum = `$$${parsed.packNo}${cmdData.length + parsed.id.length + 1},${parsed.id},${cmdData}`;
        const body = `,${parsed.id},${cmdData}`;
        const packLen = body.length;
        const bodyWithoutChecksum = `$$${parsed.packNo}${packLen}${body}`;

        const checksum = calcChecksum(bodyWithoutChecksum);

        const ackPacket = `${bodyWithoutChecksum}${checksum}\r\n`;

        logger.info("========== ACK ==========");
        logger.info(ackPacket);
        logger.info("=========================");

        socket.write(ackPacket, 'ascii');
        logger.info(`VT100: ACK ${parsed.cmd} dikirim ke ${parsed.id}, pack-no=${parsed.packNo}`);
      }
      // cmd 000: tidak perlu ACK
    }
  } catch (err) {
    logger.error('VT100 handler error', err);
  }
};