const { ethers } = require("hardhat");
const { getRunnerFactoryAddress, setDeployed } = require("../deploy/isDeployed");

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function createRunner() {
    const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory", signer);
    const runnerFactory = RunnerFactoryContract.attach(await getRunnerFactoryAddress());

    const tx = await runnerFactory.createRunner();
    await tx.wait();

    const filter = runnerFactory.filters.RunnerCreated();
    const events = await runnerFactory.queryFilter(filter);
    const runnerAddress = events[events.length - 1].args.runnerAddress;

    await setDeployed("Runner", runnerAddress);

    console.log("Runner Contract deployed to address:", runnerAddress);
}

async function main() {
    await createRunner();
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});