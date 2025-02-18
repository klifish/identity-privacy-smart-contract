const { ethers } = require("hardhat")
const { getRegistryAddress } = require("./isDeployed.js")

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployRunnerFactory() {

    const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory", signer);
    const runnerFactory = await RunnerFactoryContract.deploy(process.env.ENTRY_POINT, await getRegistryAddress())
    const address = await runnerFactory.getAddress()
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