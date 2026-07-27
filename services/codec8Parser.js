exports.parse = (buf) => {

    const records = [];

    // Header
    const codecId = buf.readUInt8(8);
    const recordCount = buf.readUInt8(9);

    let offset = 10;

    console.log("====================================");
    console.log("Codec ID :", codecId);
    console.log("Record Count :", recordCount);
    console.log("====================================");

    for (let i = 0; i < recordCount; i++) {

        const recordStart = offset;

        // --------------------
        // DEBUG RAW
        // --------------------
        console.log(`\n===== RECORD ${i + 1} =====`);
        console.log("RAW :", buf.slice(recordStart, recordStart + 40).toString("hex"));

        // --------------------
        // GPS ELEMENT
        // --------------------

        const timestampRaw = buf.readBigUInt64BE(offset);
        const timestamp = Number(timestampRaw);
        offset += 8;

        const priority = buf.readUInt8(offset);
        offset += 1;

        const longitude = buf.readInt32BE(offset) / 10000000;
        offset += 4;

        const latitude = buf.readInt32BE(offset) / 10000000;
        offset += 4;

        const altitude = buf.readUInt16BE(offset);
        offset += 2;

        const angle = buf.readUInt16BE(offset);
        offset += 2;

        const satellites = buf.readUInt8(offset);
        offset += 1;

        const speed = buf.readUInt16BE(offset);
        offset += 2;

        console.log("========== GPS ==========");
        console.log("Offset GPS :", offset);

        console.log("Raw Longitude :", buf.readInt32BE(recordStart + 9));
        console.log("Raw Latitude  :", buf.readInt32BE(recordStart + 13));

        console.log("Longitude :", longitude);
        console.log("Latitude  :", latitude);

        console.log(
            `Google Maps : https://maps.google.com/?q=${latitude},${longitude}`
        );

        console.log("=========================");

        console.log({
            timestampHex: buf.slice(recordStart, recordStart + 8).toString("hex"),
            priorityHex: buf.slice(recordStart + 8, recordStart + 9).toString("hex"),
            longitudeHex: buf.slice(recordStart + 9, recordStart + 13).toString("hex"),
            latitudeHex: buf.slice(recordStart + 13, recordStart + 17).toString("hex"),
            gpsTailHex: buf.slice(recordStart + 17, recordStart + 24).toString("hex"),
        });

        console.log({
            timestamp: new Date(timestamp).toISOString(),
            priority,
            longitude,
            latitude,
            altitude,
            angle,
            satellites,
            speed
        });

        // --------------------
        // IO ELEMENT
        // --------------------

        const eventId = buf.readUInt8(offset);
        offset++;

        const totalIo = buf.readUInt8(offset);
        offset++;

        const io = {};

        // 1 BYTE
        const n1 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n1; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readUInt8(offset);
            offset++;

            io[id] = value;
        }

        // 2 BYTE
        const n2 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n2; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readUInt16BE(offset);
            offset += 2;

            io[id] = value;
        }

        // 4 BYTE
        const n4 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n4; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readUInt32BE(offset);
            offset += 4;

            io[id] = value;
        }

        // 8 BYTE
        const n8 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n8; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readBigUInt64BE(offset);
            offset += 8;

            io[id] = value.toString();
        }

        console.log("IO :", io);

        // baru
        console.log("Offset Setelah IO :", offset);
        console.log("Packet Length :", buf.length);

        console.log("Record yang akan dikirim:");

        console.log({
            timestamp: new Date(timestamp).toISOString(),
            latitude,
            longitude,
            speed,
            satellites,
            battery: io[67],
            voltage: io[66],
            gsm: io[21],
            ignition: io[239]
        });

        records.push({
            timestamp,
            priority,
            longitude,
            latitude,
            altitude,
            angle,
            satellites,
            speed,
            eventId,
            totalIo,
            io
        });

    }

    return records;

};