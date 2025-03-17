const { setupHasher, hashLeftRightNew } = require("./utilities/hasher")
const { getRegistryAddress } = require("./isDeployed.js")
const ffjavascript = require("ffjavascript");
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

    const RegistryContract = await ethers.getContractFactory("MerkleRegistry", signer);
    const registry = await RegistryContract.attach(await getRegistryAddress());

    for (let i = 0; i <= levels; i++) {
        zero_i = await registry.zeros(i);
        console.log(zero_i.toString(16))
    }

}

module.exports = { buildZeros }

// async function main() {
//     const hasher = await setupHasher()
//     await buildZeros(hasher, 20, 0)
// }

// main().then(() => process.exit(0)).catch(error => {
//     console.error(error);
//     process.exit(1);
// });