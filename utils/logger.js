module.exports = {
  info: (...args) => console.log('[INFO]', ...args),
  debug: (...args) => {
    if (process.env.DEBUG) console.log('[DEBUG]', ...args);
  },
  error: (...args) => console.error('[ERROR]', ...args),
};
