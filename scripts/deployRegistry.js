const { ethers } = require("hardhat")
const { deployHasher } = require("./deployHasher")
const { deployRegisterVerifier } = require("./deployRegisterVerifier")
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployRegistry() {
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
    const RegistryContract = await ethers.getContractFactory("MerkleRegistry", signer);

    const hasherAddress = process.env.HASHER_ADDRESS
    const verifierAddress = process.env.REGISTER_VERIFIER

    const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherAddress, verifierAddress);
    // const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, "0x5FbDB2315678afecb367f032d93F642f64180aa3");
    const address = await registry.getAddress();


    console.log("Registry Contract deployed to address:", address)
    return address;
}

module.exports = { deployRegistry }

// main().then(() => process.exit(0)).catch(error => {
//     console.error(error);
//     process.exit(1);
// });