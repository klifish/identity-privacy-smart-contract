const { ethers } = require("hardhat");
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function createRunner() {
    const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory", signer)
    const runnerFactory = RunnerFactoryContract.attach(process.env.RUNNER_FACTORY)

    const tx = await runnerFactory.createRunner()
    await tx.wait()
    console.log("Runner created")


}

async function main() {
    await createRunner()
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});