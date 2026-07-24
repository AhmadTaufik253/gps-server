const axios = require('axios');
const logger = require('../utils/logger');

const API_URL = process.env.LARAVEL_API_URL;
const TOKEN = process.env.LARAVEL_API_TOKEN || null;
const MAX_ATTEMPTS = parseInt(process.env.API_RETRY_ATTEMPTS || '5', 10);
const RETRY_DELAY = parseInt(process.env.API_RETRY_DELAY_MS || '500', 10);

if (!API_URL) {
  logger.error('LARAVEL_API_URL not set in .env');
  process.exit(1);
}

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * payload: { imei, lat, lng, speed, course, device_time, raw }
 */
module.exports.postPosition = async (payload) => {
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    try {
      attempt++;
      const headers = {
        'Content-Type': 'application/json'
      };
      if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

      await axios.post(API_URL, payload, { headers, timeout: 10000 });
      logger.info(`Posted position imei=${payload.imei} lat=${payload.lat} lng=${payload.lng}`);
      return true;
    } catch (err) {
      logger.error(`Failed to post to API (attempt ${attempt}): ${err.message}`);
      if (attempt >= MAX_ATTEMPTS) {
        logger.error('Max attempts reached, dropping packet or storing for retry (not implemented).');
        // TODO: enqueue to DB/Redis for later retry
        return false;
      }
      // exponential backoff
      await delay(RETRY_DELAY * attempt);
    }
  }
};
