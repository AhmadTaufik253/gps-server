// // services/deviceService.js
// module.exports.getDeviceProtocol = async (hex, buf) => {
//   // GT06 common headers: 0x7878 or 0x7979
//   if (hex.startsWith('7878') || hex.startsWith('7979')) return 'gt06';

//   // VT100 / Istartek often uses 0x6767 or ASCII payloads starting with IMEI digits
//   if (hex.startsWith('6767')) return 'vt100';

//   // if buffer contains ascii with commas like "imei,lat,lon,..." treat vt100/ascii
//   try {
//     const ascii = buf.toString();
//     if (ascii.includes(',') && /^[0-9]{8,16}/.test(ascii.trim())) return 'vt100';
//   } catch (e) {}

//   return 'generic';
// };

// services/deviceService.js
module.exports.getDeviceProtocol = async (hex, buf) => {
  // GT06 common headers: 0x7878 or 0x7979
  if (hex.startsWith('7878') || hex.startsWith('7979')) return 'gt06';

  // VT100 / Istartek often uses 0x6767 or ASCII payloads starting with IMEI digits
  // if (hex.startsWith('6767')) return 'vt100';
  // iStartek / VT100-L: paket selalu mulai dengan "&&" (ASCII) = 0x26 0x26
  if (buf.length >= 2 && buf[0] === 0x26 && buf[1] === 0x26) return 'vt100';

  // if buffer contains ascii with commas like "imei,lat,lon,..." treat vt100/ascii
  // try {
  //   const ascii = buf.toString();
  //   if (ascii.includes(',') && /^[0-9]{8,16}/.test(ascii.trim())) return 'vt100';
  // } catch (e) {}

  // format: 2-byte length prefix diikuti IMEI ASCII murni (contoh: 000f + 15 digit)
  try {
    if (buf.length >= 4) {
      const lengthByte = buf.readUInt16BE(0);
      if (lengthByte > 0 && lengthByte <= buf.length - 2 && lengthByte <= 20) {
        const possibleImei = buf.slice(2, 2 + lengthByte).toString('ascii');
        if (/^\d{10,17}$/.test(possibleImei)) return 'textImei';
      }
    }
  } catch (e) {}

  return 'generic';
};
