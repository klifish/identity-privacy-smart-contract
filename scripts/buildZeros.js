const { hashLeftRightNew } = require("./utilities/hasher")
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function buildZeros(hasher, levels, zeroElement) {
    _zeros = [zeroElement]
    for (let i = 1; i <= levels; i++) {
        _zeros[i] = hashLeftRightNew(hasher, _zeros[i - 1], _zeros[i - 1])
    }


    for (let i = 0; i <= levels; i++) {
        let h = _zeros[i].toString(16);

    }

    return _zeros;
}

module.exports = { buildZeros }
