const { ethers } = require("hardhat");
const {
    getRandomRunnerAddress,
    getFirstRunnerAddress,
    getAccountFactoryAddress,
    getRunnerFactoryAddress,
    getVerifyingPaymsaterAddress } = require('./isDeployed');
const fs = require("fs");

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function getDepositInfo(entryPoint, targetAddress) {
    const depositInfo = await entryPoint.getDepositInfo(targetAddress);
    console.log("Deposit info:", depositInfo);
}

async function depositToEntryPoint(entryPoint, targetAddress, amountInEther) {
    // const tx = await entryPoint.connect(signer).depositTo(targetAddress, amountInEther);
    const tx = await entryPoint.connect(signer).depositTo(targetAddress, {
        value: ethers.parseEther(amountInEther.toString())
    });
    console.log("Deposit transaction hash:", tx.hash);
    await tx.wait();
    console.log("Deposit completed.");
}



async function main() {
    const targetAddress = await getVerifyingPaymsaterAddress();
    const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;
    const entryPointAddress = process.env.ENTRY_POINT;
    const entryPoint = new ethers.Contract(entryPointAddress, entryPointAbi, alchemyProvider);

    await getDepositInfo(entryPoint, targetAddress);
    await depositToEntryPoint(entryPoint, targetAddress, 5); // deposits 0.01 ETH
    await getDepositInfo(entryPoint, targetAddress);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });