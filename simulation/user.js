const { createSmartWallet, registerUserSmartWallet } = require('./smartAccountManager')
const { deployUserDataWithSmartAccountSingle, deployUserDataContractWithPrivacySingle } = require('./userDataDeployer')

const walletsFilePath = "./simulation/wallets.json";
const fs = require("fs");
const path = require("path");
const logFilePath = path.join(__dirname, 'simulation.log');
function logToFile(message) {
    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${message}\n`);
}
const { ethers } = require("hardhat");
async function simulateSingleUser(secret, mode = "standard") {
    // 1. create a smart account for the user
    const smartAccountAddress = await createSmartWallet(secret);
    console.log("Smart account created at address:", smartAccountAddress);
    logToFile("Smart account created at address: " + smartAccountAddress);

    if (mode === "standard") {
        // 2. deploy the user data contract with the smart account
        const userDataAddress = await deployUserDataWithSmartAccountSingle(secret, smartAccountAddress);
        console.log("User data contract deployed at address:", userDataAddress);
        logToFile("User data contract deployed at address: " + userDataAddress);
    } else if (mode === "privacy") {
        // 2. register the user with the smart account
        await registerUserSmartWallet(secret, smartAccountAddress);
        console.log("User registered with smart account: ", smartAccountAddress);
        logToFile("User registered with smart account: " + smartAccountAddress);

        const userDataAddress = await deployUserDataContractWithPrivacySingle(secret, smartAccountAddress);
        console.log("User data contract deployed with privacy at address:", userDataAddress);
        logToFile("User data contract deployed with privacy at address: " + userDataAddress);

        // 3. deploy the user data contract with privacy solution
    }
}

async function main() {
    // current block number
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log("Current block number:", blockNumber);
    logToFile("Current block number: " + blockNumber);

    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    for (let wallet of wallets) {
        const secret = wallet.secret;
        await simulateSingleUser(secret, "privacy");
        // await simulateSingleUser(secret, "standard");
        // console.log("Simulation completed for wallet:", wallet.index);
    }

    const blockNumber2 = await ethers.provider.getBlockNumber();
    console.log("Current block number:", blockNumber2);
    logToFile("Current block number: " + blockNumber2);
}

main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        logToFile(error.toString());
        process.exit(1);
    });