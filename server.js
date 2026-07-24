require('dotenv').config();
const net = require('net');
const deviceService = require('./services/deviceService');
const handlers = {
  gt06: require('./handlers/gt06Handler'),
  vt100: require('./handlers/vt100Handler'),
  generic: require('./handlers/genericHandler'),
};
const logger = require('./utils/logger');

const PORT = parseInt(process.env.TCP_PORT || '7000', 10);

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  logger.info(`New connection from ${remote}`);

  socket.on('data', async (buf) => {
    try {
      // keep original buffer, but prefer hex string for parsers
      const hex = buf.toString('hex');
      logger.debug(`RAW from ${remote}: ${hex}`);

      // detect protocol
      const proto = await deviceService.getDeviceProtocol(hex, buf);

      const handler = handlers[proto] || handlers.generic;
      // each handler should parse and call locationService.postPosition(...)
      await handler.process(socket, buf, hex);
    } catch (err) {
      logger.error('Error processing data:', err);
    }
  });

  socket.on('close', () => logger.info(`Connection closed ${remote}`));
  socket.on('error', (err) => logger.error(`Socket error ${remote}:`, err));
});

server.on('error', (err) => {
  logger.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info(`TCP server listening on port ${PORT}`);
});
