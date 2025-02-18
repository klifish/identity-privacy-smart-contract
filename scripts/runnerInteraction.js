const { ethers } = require("hardhat");
const { getRandomRunnerAddress, getFirstRunnerAddress, getAccountFactoryAddress } = require('./isDeployed');


const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function getNonce() {
    const RunnerContract = await ethers.getContractFactory("Runner", signer);
    const runnerAddress = await getFirstRunnerAddress();
    console.log("Runner address:", runnerAddress);
    const runner = RunnerContract.attach(runnerAddress);

    const nonce = await runner.getNonce();
    console.log("Nonce:", nonce);
}

async function main() {
    await getNonce();
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});