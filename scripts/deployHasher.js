const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const { ethers } = require("hardhat");
const circomlibjs = require("circomlibjs")


// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

const SEED = "mimcsponge";

async function deployHasher() {

    const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
    const abi = circomlibjs.mimcSpongecontract.abi;
    const C = new ethers.ContractFactory(abi, bytecode, signer)
    // const gasSettings = {
    //     maxPriorityFeePerGas: ethers.parseUnits('30', 'gwei'), // Suggested value based on error message
    //     maxFeePerGas: ethers.parseUnits('60', 'gwei'), // Suggested value for maximum fee
    //     gasLimit: ethers.hexlify(5000000) // Set a reasonable gas limit for the contract deployment
    // };
    const mimc = await C.deploy()
    const address = await mimc.getAddress()

    console.log("Hasher Contract deployed to address:", address)
    return address
}

// main().then(() => process.exit(0)).catch(error => {
//     console.error(error);
//     process.exit(1);
// });

module.exports = { deployHasher }