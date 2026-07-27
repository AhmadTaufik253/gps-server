exports.parse = (buf) => {

    const records = [];

    const codecId = buf.readUInt8(8);
    const recordCount = buf.readUInt8(9);

    let offset = 10;

    for (let i = 0; i < recordCount; i++) {

        const timestamp = Number(buf.readBigUInt64BE(offset));
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

        // --------------------
        // IO ELEMENTS
        // --------------------

        const eventId = buf.readUInt8(offset);
        offset++;

        const totalIo = buf.readUInt8(offset);
        offset++;

        const io = {};

        // ---------- 1 BYTE ----------
        const n1 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n1; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readUInt8(offset);
            offset++;

            io[id] = value;
        }

        // ---------- 2 BYTE ----------
        const n2 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n2; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readUInt16BE(offset);
            offset += 2;

            io[id] = value;
        }

        // ---------- 4 BYTE ----------
        const n4 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n4; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readUInt32BE(offset);
            offset += 4;

            io[id] = value;
        }

        // ---------- 8 BYTE ----------
        const n8 = buf.readUInt8(offset);
        offset++;

        for (let j = 0; j < n8; j++) {

            const id = buf.readUInt8(offset);
            offset++;

            const value = buf.readBigUInt64BE(offset);
            offset += 8;

            io[id] = value.toString();
        }

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