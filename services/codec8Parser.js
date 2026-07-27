exports.parse = (buf) => {

    const result = [];

    const codec = buf.readUInt8(8);

    const recordCount = buf.readUInt8(9);

    let offset = 10;

    for(let i=0;i<recordCount;i++){

        const timestamp = Number(buf.readBigUInt64BE(offset));

        offset += 8;

        const priority = buf.readUInt8(offset);

        offset++;

        const longitude = buf.readInt32BE(offset) / 10000000;

        offset += 4;

        const latitude = buf.readInt32BE(offset) / 10000000;

        offset += 4;

        const altitude = buf.readUInt16BE(offset);

        offset +=2;

        const angle = buf.readUInt16BE(offset);

        offset +=2;

        const satellites = buf.readUInt8(offset);

        offset++;

        const speed = buf.readUInt16BE(offset);

        offset +=2;

        result.push({

            timestamp,

            priority,

            longitude,

            latitude,

            altitude,

            angle,

            satellites,

            speed

        });

        // parsing IO nanti kita lanjut
        break;

    }

    return result;

}