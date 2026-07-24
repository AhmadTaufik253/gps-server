module.exports.process = async (socket, buf, hex) => {
    console.log("Unknown device format:", hex);
    return 'OK';
};
