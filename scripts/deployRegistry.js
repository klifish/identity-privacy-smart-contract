const { ethers } = require("hardhat")
const { deployHasher } = require("./deployHasher")
const { deployRegisterVerifier } = require("./deployRegisterVerifier")
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const { getHasherAddress, getRegisterVerifierAddress } = require("./isDeployed.js");


// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployRegistry() {
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
    const RegistryContract = await ethers.getContractFactory("MerkleRegistry", signer);

    const hasherAddress = await getHasherAddress();
    const verifierAddress = await getRegisterVerifierAddress()

    const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherAddress, verifierAddress);
    const address = await registry.getAddress();


    return address;
}

module.exports = { deployRegistry }

// main().then(() => process.exit(0)).catch(error => {
//     console.error(error);
//     process.exit(1);
// });