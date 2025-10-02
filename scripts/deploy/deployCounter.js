const { ethers } = require("hardhat")

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployCounter() {
    const CounterContract = await ethers.getContractFactory("Counter", signer);
    const counter = await CounterContract.deploy(0);
    const address = await counter.getAddress();

    console.log("Counter deployed to:", address);
}

async function main() {
    await deployCounter();
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});