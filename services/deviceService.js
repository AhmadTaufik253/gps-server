// services/deviceService.js
module.exports.getDeviceProtocol = async (hex, buf) => {
  // GT06 common headers: 0x7878 or 0x7979
  if (hex.startsWith('7878') || hex.startsWith('7979')) return 'gt06';

  // VT100 / Istartek often uses 0x6767 or ASCII payloads starting with IMEI digits
  if (hex.startsWith('6767')) return 'vt100';

  // if buffer contains ascii with commas like "imei,lat,lon,..." treat vt100/ascii
  try {
    const ascii = buf.toString();
    if (ascii.includes(',') && /^[0-9]{8,16}/.test(ascii.trim())) return 'vt100';
  } catch (e) {}

  return 'generic';
};
