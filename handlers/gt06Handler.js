// // const locationService = require('../services/locationService');
// // const logger = require('../utils/logger');

// // function hexToInt(hex) {
// //   return parseInt(hex, 16);
// // }
// // function decodeCoordinate(hex) {
// //   // GT06 lat/lng usually in 4 bytes (8 hex chars) scaled by 30000 or 1800000 depending variant.
// //   // Common formula: parseInt / 30000 or / 1800000 (many GT06 use 30000 for degrees-minutes)
// //   // We'll try divide by 30000 first; if implausible, try /1800000.
// //   const val = parseInt(hex, 16);
// //   let lat = val / 30000;
// //   if (Math.abs(lat) > 180) lat = val / 1800000;
// //   return lat;
// // }

// // module.exports.process = async (socket, buf, hex) => {
// //   try {
// //     const header = hex.substring(0, 4);
// //     if (header !== '7878' && header !== '7979') {
// //       logger.debug('GT06: header mismatch');
// //       return;
// //     }

// //     const length = hexToInt(hex.substring(4, 6));
// //     const protocol = hex.substring(6, 8);

// //     if (protocol === '01') { // login
// //       // IMEI usually located after: length 0x0b.., parse as BCD 8 bytes? Commonly next 8-16 hex
// //       const imeiHex = hex.substring(8, 8 + 16);
// //       const imei = imeiHex; // sometimes needs transform; but keep hex fallback
// //       logger.info('GT06 login imeiHex=', imeiHex);
// //       // ACK login: 78780501 + serial + 0d0a -> simplest: echo minimal ack (may vary)
// //       // We'll not send serial-specific ack here (safe)
// //       socket.write(Buffer.from('7878050100010d0a', 'hex'));
// //       return;
// //     }

// //     if (protocol === '22') { // GPS raw data
// //       // structure depends on device; this parser assumes commonly:
// //       // [header][len][proto][date(6B)][gps flag][lat(4B)][lng(4B)][speed(1B)][course(2B)][...][serial][crc][0d0a]
// //       // positions (example indices, adjust if different)
// //       // Date: hex[8..19], gps flag = hex[20..21], lat = hex[22..29], lng = hex[30..37], speed = hex[38..39], course = hex[40..43]
// //       const dateHex = hex.substring(8, 20);
// //       // parse date roughly
// //       const yy = parseInt(dateHex.substring(0, 2), 16) + 2000;
// //       const mm = parseInt(dateHex.substring(2, 4), 16);
// //       const dd = parseInt(dateHex.substring(4, 6), 16);
// //       const hh = parseInt(dateHex.substring(6, 8), 16);
// //       const mi = parseInt(dateHex.substring(8, 10), 16);
// //       const ss = parseInt(dateHex.substring(10, 12), 16);
// //       const device_time = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')} ${String(hh).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;

// //       const latHex = hex.substring(22, 30);
// //       const lngHex = hex.substring(30, 38);

// //       const lat = decodeCoordinate(latHex);
// //       const lng = decodeCoordinate(lngHex);

// //       const speed = hexToInt(hex.substring(38, 40));
// //       const course = hexToInt(hex.substring(40, 44)) & 0x03FF;

// //       // IMEI: often located earlier in login or in a different packet; for many GT06 the IMEI of device is in login packet
// //       // If no imei in this packet, you'd need to track socket->imei mapping from login.
// //       // Here we attempt to parse IMEI from tail-of-packet fallback (not always present)
// //       let imei = null;
// //       // Try to extract 15-16 ascii digits somewhere (quick heuristic)
// //       const ascii = buf.toString();
// //       const m = ascii.match(/(\d{10,16})/);
// //       if (m) imei = m[1];

// //       // If imei still null, try reading from the login map (not implemented) - fallback to unknown
// //       if (!imei) imei = 'unknown';

// //       // Build payload
// //       const payload = {
// //         imei,
// //         lat,
// //         lng,
// //         speed,
// //         course,
// //         device_time,
// //         raw: hex
// //       };

// //       await locationService.postPosition(payload);

// //       // ACK back: typical ACK for gps (protocol 0x22) -> 78780522 + serial(2byte) + 0d0a
// //       const serial = hex.substring(hex.length - 12, hex.length - 8); // serial is 2 bytes (4 hex chars), located before error check (2 bytes) and 0d0a (2 bytes)
// //       try {
// //         socket.write(Buffer.from(`78780522${serial}0d0a`, 'hex'));
// //       } catch (e) {
// //         // ignore send error
// //       }
// //       return;
// //     }

// //     // heartbeat / status (0x13, 0x26 etc) -> reply simple ack
// //     if (protocol === '13' || protocol === '26') {
// //       const serial = hex.substring(hex.length - 12, hex.length - 8);
// //       try {
// //         socket.write(Buffer.from(`787805${protocol}${serial}0d0a`, 'hex'));
// //       } catch (e) {}
// //       logger.debug('GT06 heartbeat/status ack sent');
// //       return;
// //     }

// //     logger.debug('GT06: unsupported protocol', protocol);
// //   } catch (err) {
// //     logger.error('GT06 handler error', err);
// //   }
// // };

// const locationService = require('../services/locationService');
// const logger = require('../utils/logger');

// function hexToInt(hex) {
//   return parseInt(hex, 16);
// }

// function decodeCoordinate(hex) {
//   const val = parseInt(hex, 16);
//   let lat = val / 30000;
//   if (Math.abs(lat) > 180) lat = val / 1800000;
//   return lat;
// }

// // CRC16 ITU (X.25) - standar dipakai protokol GT06
// function crc16(buffer) {
//   let crc = 0xFFFF;
//   for (let i = 0; i < buffer.length; i++) {
//     crc ^= buffer[i];
//     for (let j = 0; j < 8; j++) {
//       if (crc & 0x0001) {
//         crc = (crc >> 1) ^ 0x8408;
//       } else {
//         crc = crc >> 1;
//       }
//     }
//   }
//   return (~crc) & 0xFFFF;
// }

// function buildAck(protocolHex, serialHex) {
//   const contentHex = `05${protocolHex}${serialHex}`;
//   const content = Buffer.from(contentHex, 'hex');
//   const crc = crc16(content);
//   const crcHex = crc.toString(16).padStart(4, '0');
//   return Buffer.from(`7878${contentHex}${crcHex}0d0a`, 'hex');
// }

// function extractSerial(hex) {
//   return hex.substring(hex.length - 12, hex.length - 8);
// }

// function extractImei(buf) {
//   const ascii = buf.toString();
//   const m = ascii.match(/(\d{10,16})/);
//   return m ? m[1] : 'unknown';
// }

// // Parser umum buat packet yang strukturnya kayak GPS (dipakai protocol 22 & 16)
// function parseGpsLikePacket(hex) {
//   const dateHex = hex.substring(8, 20);
//   const yy = parseInt(dateHex.substring(0, 2), 16) + 2000;
//   const mm = parseInt(dateHex.substring(2, 4), 16);
//   const dd = parseInt(dateHex.substring(4, 6), 16);
//   const hh = parseInt(dateHex.substring(6, 8), 16);
//   const mi = parseInt(dateHex.substring(8, 10), 16);
//   const ss = parseInt(dateHex.substring(10, 12), 16);
//   const device_time = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')} ${String(hh).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;

//   const latHex = hex.substring(22, 30);
//   const lngHex = hex.substring(30, 38);
//   const lat = decodeCoordinate(latHex);
//   const lng = decodeCoordinate(lngHex);
//   const speed = hexToInt(hex.substring(38, 40));
//   const course = hexToInt(hex.substring(40, 44)) & 0x03FF;

//   return { device_time, lat, lng, speed, course };
// }

// module.exports.process = async (socket, buf, hex) => {
//   try {
//     logger.info('=== RAW PACKET DEBUG ===');
//     logger.info('FULL HEX:', hex);
//     logger.info('HEX LENGTH (chars):', hex.length, '| BYTES:', hex.length / 2);

//     const header = hex.substring(0, 4);
//     if (header !== '7878' && header !== '7979') {
//       logger.debug('GT06: header mismatch');
//       return;
//     }

//     const length = hexToInt(hex.substring(4, 6));
//     const protocol = hex.substring(6, 8);

//     logger.info('HEADER:', header, '| LENGTH BYTE:', hex.substring(4, 6), '(=', length, ')', '| PROTOCOL:', protocol);

//     // === LOGIN ===
//     if (protocol === '01') {
//       const imeiHex = hex.substring(8, 8 + 16);
//       logger.info('GT06 login imeiHex=', imeiHex);

//       const serialHex = extractSerial(hex);
//       const ack = buildAck('01', serialHex);
//       logger.info('ACK PACKET SENT:', ack.toString('hex'));

//       socket.write(ack);
//       return;
//     }

//     // === GPS DATA (22) & ALARM DATA (16, struktur mirip GPS) ===
//     if (protocol === '22' || protocol === '16') {
//       logger.info(`FULL PACKET HEX (protocol ${protocol}):`, hex);

//       const { device_time, lat, lng, speed, course } = parseGpsLikePacket(hex);

//       logger.info(`PARSED (protocol ${protocol}) -> time:`, device_time, '| lat:', lat, '| lng:', lng, '| speed:', speed, '| course:', course);

//       // cuma simpen kalau lat/lng masuk akal (bukan 0 / nilai aneh)
//       if (Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001) {
//         const imei = extractImei(buf);
//         const payload = { imei, lat, lng, speed, course, device_time, raw: hex };

//         try {
//           await locationService.postPosition(payload);
//           logger.info(`Posisi (protocol ${protocol}) berhasil dikirim ke Laravel`);
//         } catch (e) {
//           logger.error(`Gagal kirim posisi (protocol ${protocol}) ke Laravel`, e);
//         }
//       } else {
//         logger.info(`Lat/lng nggak valid buat protocol ${protocol}, skip simpan ke Laravel`);
//       }

//       const serialHex = extractSerial(hex);
//       try {
//         const ack = buildAck(protocol, serialHex);
//         socket.write(ack);
//         logger.info(`ACK sent for protocol ${protocol}:`, ack.toString('hex'));
//       } catch (e) {
//         logger.error(`Failed to send ack for protocol ${protocol}`, e);
//       }
//       return;
//     }

//     // === HEARTBEAT / STATUS (13, 26) ===
//     if (protocol === '13' || protocol === '26') {
//       logger.info('FULL HEARTBEAT/STATUS PACKET HEX:', hex);
//       const serialHex = extractSerial(hex);
//       try {
//         const ack = buildAck(protocol, serialHex);
//         socket.write(ack);
//         logger.info(`GT06 heartbeat/status (${protocol}) ack sent:`, ack.toString('hex'));
//       } catch (e) {
//         logger.error('Failed to send heartbeat ack', e);
//       }
//       return;
//     }

//     // === PROTOCOL LAIN (misal 18 = LBS multi-base-station, 90 = info lain, dst) ===
//     // tetap kirim generic ACK biar device nggak nganggep gagal & disconnect
//     logger.info('GT06: unhandled protocol (sending generic ack)', protocol, '| FULL HEX:', hex);
//     try {
//       const serialHex = extractSerial(hex);
//       const ack = buildAck(protocol, serialHex);
//       socket.write(ack);
//       logger.info(`Generic ACK sent for protocol ${protocol}:`, ack.toString('hex'));
//     } catch (e) {
//       logger.error('Failed to send generic ack for protocol ' + protocol, e);
//     }
//     return;

//   } catch (err) {
//     logger.error('GT06 handler error', err);
//   }
// };


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