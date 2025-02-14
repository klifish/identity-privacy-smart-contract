const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const fs = require('fs');
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

    const mimc = await C.deploy()
    const address = await mimc.getAddress()

    console.log("Hasher Contract deployed to address:", address)
    return address
}


module.exports = { deployHasher }