
const locationService = require('../services/locationService');
const logger = require('../utils/logger');

function hexToInt(hex) {
  return parseInt(hex, 16);
}

function decodeCoordinate(hex) {
  const val = parseInt(hex, 16);
  let lat = val / 30000;
  if (Math.abs(lat) > 180) lat = val / 1800000;
  return lat;
}

function crc16(buffer) {
  let crc = 0xFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0x8408;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return (~crc) & 0xFFFF;
}

function buildAck(protocolHex, serialHex) {
  const contentHex = `05${protocolHex}${serialHex}`;
  const content = Buffer.from(contentHex, 'hex');
  const crc = crc16(content);
  const crcHex = crc.toString(16).padStart(4, '0');
  return Buffer.from(`7878${contentHex}${crcHex}0d0a`, 'hex');
}

function extractSerial(hex) {
  return hex.substring(hex.length - 12, hex.length - 8);
}

function decodeImeiBCD(imeiHex) {
  return imeiHex.replace(/^0/, '');
}

// Parser GPS: dipakai protocol 22, 16, dan 12 (struktur byte-nya sama)
function parseGpsLikePacket(hex) {
  const dateHex = hex.substring(8, 20);
  const yy = parseInt(dateHex.substring(0, 2), 16) + 2000;
  const mm = parseInt(dateHex.substring(2, 4), 16);
  const dd = parseInt(dateHex.substring(4, 6), 16);
  const hh = parseInt(dateHex.substring(6, 8), 16);
  const mi = parseInt(dateHex.substring(8, 10), 16);
  const ss = parseInt(dateHex.substring(10, 12), 16);
  const device_time = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')} ${String(hh).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;

  const latHex = hex.substring(22, 30);
  const lngHex = hex.substring(30, 38);
  let lat = decodeCoordinate(latHex);
  let lng = decodeCoordinate(lngHex);

  const speed = hexToInt(hex.substring(38, 40));
  const courseStatusHex = hex.substring(40, 44);
  const courseStatus = hexToInt(courseStatusHex);

  // bit hemisphere: 0x1000 = Selatan (lat negatif), 0x2000 = Barat (lng negatif)
  const isSouth = (courseStatus & 0x1000) !== 0;
  const isWest = (courseStatus & 0x2000) !== 0;
  if (isSouth) lat = -Math.abs(lat);
  if (isWest) lng = -Math.abs(lng);

  const course = courseStatus & 0x03FF;

  return { device_time, lat, lng, speed, course };
}

module.exports.process = async (socket, buf, hex) => {
  try {
    logger.info('=== RAW PACKET DEBUG ===');
    logger.info('FULL HEX:', hex);
    logger.info('HEX LENGTH (chars):', hex.length, '| BYTES:', hex.length / 2);

    const header = hex.substring(0, 4);
    if (header !== '7878' && header !== '7979') {
      logger.debug('GT06: header mismatch');
      return;
    }

    const length = hexToInt(hex.substring(4, 6));
    const protocol = hex.substring(6, 8);

    logger.info('HEADER:', header, '| LENGTH BYTE:', hex.substring(4, 6), '(=', length, ')', '| PROTOCOL:', protocol);

    // === LOGIN ===
    if (protocol === '01') {
      const imeiHex = hex.substring(8, 8 + 16);
      const imei = decodeImeiBCD(imeiHex);
      logger.info('GT06 login imei=', imei, '(raw hex:', imeiHex, ')');

      socket.deviceImei = imei;

      const serialHex = extractSerial(hex);
      const ack = buildAck('01', serialHex);
      logger.info('ACK PACKET SENT:', ack.toString('hex'));

      socket.write(ack);
      return;
    }

    // === GPS DATA: protocol 22 (standar), 16 (alarm), 12 (varian BT100-C) ===
    if (protocol === '22' || protocol === '16' || protocol === '12') {
      logger.info(`FULL PACKET HEX (protocol ${protocol}):`, hex);

      const { device_time, lat, lng, speed, course } = parseGpsLikePacket(hex);
      logger.info(`PARSED (protocol ${protocol}) -> time:`, device_time, '| lat:', lat, '| lng:', lng, '| speed:', speed, '| course:', course);

      if (Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001) {
        const imei = socket.deviceImei;

        if (!imei) {
          logger.error(`IMEI belum diketahui (belum ada login di koneksi ini), skip kirim protocol ${protocol}`);
        } else {
          const payload = { imei, lat, lng, speed, course, device_time, raw: hex };
          try {
            await locationService.postPosition(payload);
            logger.info(`Posisi (protocol ${protocol}) berhasil dikirim ke Laravel, imei=${imei}`);
          } catch (e) {
            logger.error(`Gagal kirim posisi (protocol ${protocol}) ke Laravel`, e);
          }
        }
      } else {
        logger.info(`Lat/lng nggak valid buat protocol ${protocol}, skip simpan ke Laravel`);
      }

      const serialHex = extractSerial(hex);
      try {
        const ack = buildAck(protocol, serialHex);
        socket.write(ack);
        logger.info(`ACK sent for protocol ${protocol}:`, ack.toString('hex'));
      } catch (e) {
        logger.error(`Failed to send ack for protocol ${protocol}`, e);
      }
      return;
    }

    // === HEARTBEAT / STATUS (13, 26) ===
    if (protocol === '13' || protocol === '26') {
      logger.info('FULL HEARTBEAT/STATUS PACKET HEX:', hex);
      const serialHex = extractSerial(hex);
      try {
        const ack = buildAck(protocol, serialHex);
        socket.write(ack);
        logger.info(`GT06 heartbeat/status (${protocol}) ack sent:`, ack.toString('hex'));
      } catch (e) {
        logger.error('Failed to send heartbeat ack', e);
      }
      return;
    }

    // === PROTOCOL LAIN (8a, 20, 18, 90, dst — LBS/config/status, bukan GPS) ===
    logger.info('GT06: unhandled protocol (sending generic ack)', protocol, '| FULL HEX:', hex);
    try {
      const asciiPreview = buf.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      logger.info(`Protocol ${protocol} ASCII preview:`, asciiPreview);
    } catch (e) {}

    try {
      const serialHex = extractSerial(hex);
      const ack = buildAck(protocol, serialHex);
      socket.write(ack);
      logger.info(`Generic ACK sent for protocol ${protocol}:`, ack.toString('hex'));
    } catch (e) {
      logger.error('Failed to send generic ack for protocol ' + protocol, e);
    }
    return;

  } catch (err) {
    logger.error('GT06 handler error', err);
  }
};