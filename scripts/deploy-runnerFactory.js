const { ethers } = require("hardhat")

async function deployRunnerFactory() {

    const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory")
    const runnerFactory = await RunnerFactoryContract.deploy(process.env.ENTRY_POINT, process.env.REGISTRY_CONTRACT_ADDRESS)
    const address = await runnerFactory.getAddress()
    console.log("Runner Factory Contract deployed to address:", address)
    return address
}

async function main() {
    await deployRunnerFactory()
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});