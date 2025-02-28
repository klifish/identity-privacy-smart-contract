const { ethers } = require("hardhat");
const { getRandomRunnerAddress, getFirstRunnerAddress, getAccountFactoryAddress, getRunnerFactoryAddress } = require('./isDeployed');


const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function getStakeInfo(entryPoint, runnerAddress) {
    const stakeInfo = await entryPoint.getStakeInfo(runnerAddress);
    console.log("Stake info:", stakeInfo);

}

async function main() {
    const runnerAddress = await getFirstRunnerAddress();
    const entryPoint = process.env.ENTRY_POINT;

    await getStakeInfo(entryPoint, runnerAddress);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });