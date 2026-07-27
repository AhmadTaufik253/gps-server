const axios = require('axios');
const logger = require('../utils/logger');

const API_URL = process.env.LARAVEL_API_URL;
const TOKEN = process.env.LARAVEL_API_TOKEN || null;

const MAX_ATTEMPTS = parseInt(process.env.API_RETRY_ATTEMPTS || '5', 10);
const RETRY_DELAY = parseInt(process.env.API_RETRY_DELAY_MS || '500', 10);

if (!API_URL) {
    logger.error('LARAVEL_API_URL not set');
    process.exit(1);
}

const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        ...(TOKEN && {
            Authorization: `Bearer ${TOKEN}`
        })
    }
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function postPosition(payload) {

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

        try {

            const response = await api.post('', payload);

            logger.info(
                `Position sent | IMEI=${payload.imei} | Status=${response.status}`
            );

            return response.data;

        } catch (err) {

            if (err.response) {

                logger.error({
                    status: err.response.status,
                    body: err.response.data
                });

            } else {

                logger.error(err.message);

            }

            if (attempt === MAX_ATTEMPTS) {

                logger.error('Max retry reached.');

                return false;

            }

            await delay(RETRY_DELAY * attempt);

        }

    }

}

module.exports = {
    postPosition
};
