// const locationService = require('../services/locationService');
// const logger = require('../utils/logger');

// function hexToInt(hex) {
//   return parseInt(hex, 16);
// }
// function decodeCoordinate(hex) {
//   // GT06 lat/lng usually in 4 bytes (8 hex chars) scaled by 30000 or 1800000 depending variant.
//   // Common formula: parseInt / 30000 or / 1800000 (many GT06 use 30000 for degrees-minutes)
//   // We'll try divide by 30000 first; if implausible, try /1800000.
//   const val = parseInt(hex, 16);
//   let lat = val / 30000;
//   if (Math.abs(lat) > 180) lat = val / 1800000;
//   return lat;
// }

// module.exports.process = async (socket, buf, hex) => {
//   try {
//     const header = hex.substring(0, 4);
//     if (header !== '7878' && header !== '7979') {
//       logger.debug('GT06: header mismatch');
//       return;
//     }

//     const length = hexToInt(hex.substring(4, 6));
//     const protocol = hex.substring(6, 8);

//     if (protocol === '01') { // login
//       // IMEI usually located after: length 0x0b.., parse as BCD 8 bytes? Commonly next 8-16 hex
//       const imeiHex = hex.substring(8, 8 + 16);
//       const imei = imeiHex; // sometimes needs transform; but keep hex fallback
//       logger.info('GT06 login imeiHex=', imeiHex);
//       // ACK login: 78780501 + serial + 0d0a -> simplest: echo minimal ack (may vary)
//       // We'll not send serial-specific ack here (safe)
//       socket.write(Buffer.from('7878050100010d0a', 'hex'));
//       return;
//     }

//     if (protocol === '22') { // GPS raw data
//       // structure depends on device; this parser assumes commonly:
//       // [header][len][proto][date(6B)][gps flag][lat(4B)][lng(4B)][speed(1B)][course(2B)][...][serial][crc][0d0a]
//       // positions (example indices, adjust if different)
//       // Date: hex[8..19], gps flag = hex[20..21], lat = hex[22..29], lng = hex[30..37], speed = hex[38..39], course = hex[40..43]
//       const dateHex = hex.substring(8, 20);
//       // parse date roughly
//       const yy = parseInt(dateHex.substring(0, 2), 16) + 2000;
//       const mm = parseInt(dateHex.substring(2, 4), 16);
//       const dd = parseInt(dateHex.substring(4, 6), 16);
//       const hh = parseInt(dateHex.substring(6, 8), 16);
//       const mi = parseInt(dateHex.substring(8, 10), 16);
//       const ss = parseInt(dateHex.substring(10, 12), 16);
//       const device_time = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')} ${String(hh).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;

//       const latHex = hex.substring(22, 30);
//       const lngHex = hex.substring(30, 38);

//       const lat = decodeCoordinate(latHex);
//       const lng = decodeCoordinate(lngHex);

//       const speed = hexToInt(hex.substring(38, 40));
//       const course = hexToInt(hex.substring(40, 44)) & 0x03FF;

//       // IMEI: often located earlier in login or in a different packet; for many GT06 the IMEI of device is in login packet
//       // If no imei in this packet, you'd need to track socket->imei mapping from login.
//       // Here we attempt to parse IMEI from tail-of-packet fallback (not always present)
//       let imei = null;
//       // Try to extract 15-16 ascii digits somewhere (quick heuristic)
//       const ascii = buf.toString();
//       const m = ascii.match(/(\d{10,16})/);
//       if (m) imei = m[1];

//       // If imei still null, try reading from the login map (not implemented) - fallback to unknown
//       if (!imei) imei = 'unknown';

//       // Build payload
//       const payload = {
//         imei,
//         lat,
//         lng,
//         speed,
//         course,
//         device_time,
//         raw: hex
//       };

//       await locationService.postPosition(payload);

//       // ACK back: typical ACK for gps (protocol 0x22) -> 78780522 + serial(2byte) + 0d0a
//       const serial = hex.substring(hex.length - 12, hex.length - 8); // serial is 2 bytes (4 hex chars), located before error check (2 bytes) and 0d0a (2 bytes)
//       try {
//         socket.write(Buffer.from(`78780522${serial}0d0a`, 'hex'));
//       } catch (e) {
//         // ignore send error
//       }
//       return;
//     }

//     // heartbeat / status (0x13, 0x26 etc) -> reply simple ack
//     if (protocol === '13' || protocol === '26') {
//       const serial = hex.substring(hex.length - 12, hex.length - 8);
//       try {
//         socket.write(Buffer.from(`787805${protocol}${serial}0d0a`, 'hex'));
//       } catch (e) {}
//       logger.debug('GT06 heartbeat/status ack sent');
//       return;
//     }

//     logger.debug('GT06: unsupported protocol', protocol);
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

// CRC16 ITU (X.25) - standar dipakai protokol GT06
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

// Bangun ACK packet lengkap: 7878 + length + protocol + serial + crc + 0d0a
function buildAck(protocolHex, serialHex) {
  // content yang di-CRC: length(1B) + protocol(1B) + serial(2B)
  const contentHex = `05${protocolHex}${serialHex}`;
  const content = Buffer.from(contentHex, 'hex');
  const crc = crc16(content);
  const crcHex = crc.toString(16).padStart(4, '0');
  return Buffer.from(`7878${contentHex}${crcHex}0d0a`, 'hex');
}

// Ambil serial number (2 byte) dari packet asli.
// Struktur umum: 7878 [len 1B] [proto 1B] [...content...] [serial 2B] [crc 2B] 0d0a
// Serial selalu 2 byte SEBELUM crc(2B)+stop(2B), jadi hitung dari belakang.
function extractSerial(hex) {
  // hex.length total karakter; stop bit 0d0a = 4 hex char, crc = 4 hex char
  // serial ada di 4 hex char sebelum crc
  return hex.substring(hex.length - 12, hex.length - 8);
}

module.exports.process = async (socket, buf, hex) => {
  try {
    const header = hex.substring(0, 4);
    if (header !== '7878' && header !== '7979') {
      logger.debug('GT06: header mismatch');
      return;
    }

    const length = hexToInt(hex.substring(4, 6));
    const protocol = hex.substring(6, 8);

    if (protocol === '01') { // login
      const imeiHex = hex.substring(8, 8 + 16);
      logger.info('GT06 login imeiHex=', imeiHex);

      const serialHex = extractSerial(hex);
      const ack = buildAck('01', serialHex);

      logger.debug('GT06 login ACK sent:', ack.toString('hex'));
      socket.write(ack);
      return;
    }

    if (protocol === '22') { // GPS raw data
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

      const lat = decodeCoordinate(latHex);
      const lng = decodeCoordinate(lngHex);

      const speed = hexToInt(hex.substring(38, 40));
      const course = hexToInt(hex.substring(40, 44)) & 0x03FF;

      let imei = null;
      const ascii = buf.toString();
      const m = ascii.match(/(\d{10,16})/);
      if (m) imei = m[1];
      if (!imei) imei = 'unknown';

      const payload = {
        imei,
        lat,
        lng,
        speed,
        course,
        device_time,
        raw: hex
      };

      await locationService.postPosition(payload);

      // ACK GPS data pakai serial asli + CRC yang bener
      const serialHex = extractSerial(hex);
      try {
        const ack = buildAck('22', serialHex);
        socket.write(ack);
        logger.debug('GT06 GPS ACK sent:', ack.toString('hex'));
      } catch (e) {
        logger.error('Failed to send GPS ack', e);
      }
      return;
    }

    // heartbeat / status (0x13, 0x26 dst) -> reply ACK sesuai protokol yang sama
    if (protocol === '13' || protocol === '26') {
      const serialHex = extractSerial(hex);
      try {
        const ack = buildAck(protocol, serialHex);
        socket.write(ack);
        logger.debug(`GT06 heartbeat/status (${protocol}) ack sent:`, ack.toString('hex'));
      } catch (e) {
        logger.error('Failed to send heartbeat ack', e);
      }
      return;
    }

    logger.debug('GT06: unsupported protocol', protocol);
  } catch (err) {
    logger.error('GT06 handler error', err);
  }
};
