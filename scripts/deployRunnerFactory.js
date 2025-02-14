const { ethers } = require("hardhat")

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployRunnerFactory() {

    const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory", signer);
    const runnerFactory = await RunnerFactoryContract.deploy(process.env.ENTRY_POINT, process.env.REGISTRY_CONTRACT_ADDRESS)
    const address = await runnerFactory.getAddress()
    console.log("Runner Factory Contract deployed to address:", address)
    return address
}

module.exports = { deployRunnerFactory }

// async function main() {
//     await deployRunnerFactory()
// }

// main().then(() => process.exit(0)).catch(error => {
//     console.error(error);
//     process.exit(1);
// });