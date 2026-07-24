// dummy-sender.js
const net = require('net');

const PORT = parseInt(process.env.TCP_PORT || '7000', 10);
const HOST = '127.0.0.1';
const imei = '356823045678902'; // dummy IMEI

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log(`Connected to GPS server on port ${PORT}`);

  setInterval(() => {
    const lat = (-6.2088 + (Math.random() - 0.5) * 0.01).toFixed(6);
    const lng = (106.8456 + (Math.random() - 0.5) * 0.01).toFixed(6);
    const speed = (Math.random() * 80).toFixed(2);
    
    // ASCII format: IMEI, datetime, validity, lat, lng, speed, course
    // e.g. "356823045678901,2403031500,A,-6.229728,106.689732,30.00,0"
    const payload = `${imei},2403031500,A,${lat},${lng},${speed},0`;

    client.write(payload);
    console.log('Sent:', payload);
  }, 5000); // kirim tiap 5 detik
});

client.on('error', (err) => {
  console.error('Connection error:', err.message);
});

client.on('close', () => {
  console.log('Connection closed');
});