const net = require("net");

const client = net.createConnection(
    {
        host: 'trolley.proxy.rlwy.net',
        port: 15735
    },
    () => {
        console.log("Connected");

        setInterval(() => {

            const lat = -6.274545 + (Math.random() * 0.0005);
            const lon = 106.690816 + (Math.random() * 0.0005);

            const packet =
                `&&A120,868373072493895,010,0,,260729203000,A,${lat.toFixed(6)},${lon.toFixed(6)},12,0.9,30,180,49,12345,510|10|1234|5678,25,0000000F,00,00,04E2|018C|01C8|0000,1,0104B046\r\n`;

            client.write(packet);

        }, 5000);

    }
);

client.on("data", d => {
    console.log("ACK :", d.toString());
});