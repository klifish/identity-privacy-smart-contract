const { ethers } = require("hardhat");
const { getRandomRunnerAddress, getFirstRunnerAddress, getAccountFactoryAddress, getRunnerFactoryAddress } = require('./deploy/isDeployed');


const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function getNonce(runnerAddress) {
    const RunnerContract = await ethers.getContractFactory("Runner", signer);
    const runner = RunnerContract.attach(runnerAddress);

    const nonce = await runner.getNonce();
    console.log("Nonce:", nonce);
}

async function getOwner(runnerAddress) {
    const RunnerContract = await ethers.getContractFactory("Runner", signer);
    const runner = RunnerContract.attach(runnerAddress);

    const owner = await runner.owner();
    console.log("Owner:", owner);
}

async function depositToRunner(runnerAddress, amountInEth = "0.1") {
    try {
        // const RunnerContract = await ethers.getContractFactory("Runner", signer);
        const runnerAddress = await getFirstRunnerAddress();

        if (!runnerAddress) {
            console.error("Runner address not found.");
            return;
        }

        const amount = ethers.parseEther(amountInEth);

        console.log(`Sending ${amountInEth} ETH to Runner at ${runnerAddress}...`);

        const tx = await signer.sendTransaction({
            to: runnerAddress,
            value: amount
        });

        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();

        const balance = await alchemyProvider.getBalance(runnerAddress);
        console.log(`New Runner balance: ${ethers.formatEther(balance)} ETH`);

    } catch (error) {
        console.error("Error depositing ETH to Runner:", error);
    }
}

async function withdrawFromRunner(runnerAddress, amountInEth) {
    try {
        if (!runnerAddress) {
            console.error("Runner address not found.");
            return;
        }

        const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory", signer);
        const runnerFactory = RunnerFactoryContract.attach(await getRunnerFactoryAddress());

        const amount = ethers.parseEther(amountInEth);
        console.log(`Withdrawing ${amountInEth} ETH from Runner at ${runnerAddress}...`);

        const tx = await runnerFactory.withdrawFromRunner(runnerAddress, amount);
        await tx.wait();

        const balance = await alchemyProvider.getBalance(runnerAddress);
        console.log(`New Runner balance: ${ethers.formatEther(balance)} ETH`);

    } catch (error) {
        console.error("Error withdrawing ETH from Runner:", error);
    }
}

async function withdrawAllFromRunner(runnerAddress) {
    try {
        const balance = await alchemyProvider.getBalance(runnerAddress);
        const balanceInEth = ethers.formatEther(balance);

        if (balance === 0n) {
            console.log("Runner has no ETH to withdraw.");
            return;
        }

        console.log(`Runner has ${balanceInEth} ETH. Withdrawing all...`);
        await withdrawFromRunner(runnerAddress, balanceInEth);

    } catch (error) {
        console.error("Error withdrawing all ETH from Runner:", error);
    }
}

async function main() {

    const runnerAddress = await getFirstRunnerAddress();

    // await getNonce(runnerAddress);
    // await getOwner(runnerAddress);
    // await depositToRunner(runnerAddress, "0.1");
    // await withdrawFromRunner(runnerAddress, "0.01");
    await withdrawAllFromRunner(runnerAddress);
}

module.exports = {
    depositToRunner,
    withdrawFromRunner,
    withdrawAllFromRunner
}