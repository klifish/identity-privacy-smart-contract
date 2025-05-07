const { createSmartWallet, registerUserSmartWallet } = require('./smartAccountManager')
const { deployUserDataWithSmartAccountSingle, deployUserDataContractWithPrivacySingle } = require('./userDataDeployer')
const { retrieveBlockRangeData, getTransactionHashesFromBlocks, getTransactionByHash, getAllTransactionData, readAllBlockData, readAllTransactionData } = require('./retrieveBlockData');
const { identifyDeployedContracts } = require('./inferenceAttack');
const { filterTransactionsByAddressRecursive } = require('./analysis');

const walletsFilePath = "./simulation/wallets.json";
const fs = require("fs");
const path = require("path");
const logFilePath = path.join(__dirname, 'simulation.log');
function logToFile(message) {
    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${message}\n`);
}
const { ethers } = require("hardhat");
const { get } = require('http');

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

        // 3. deploy the user data contract with privacy solution
        const userDataAddress = await deployUserDataContractWithPrivacySingle(secret, smartAccountAddress);
        console.log("User data contract deployed with privacy at address:", userDataAddress);
        logToFile("User data contract deployed with privacy at address: " + userDataAddress);
    }
}

function getSmartAccountAddress(wallet) {
    return wallet.smartAccountAddress;
}

function getAllSmartAccountAddresses(wallets) {
    return wallets.map(wallet => getSmartAccountAddress(wallet));
}

function getWalletsFromFile(filePath) {
    const wallets = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return wallets
}

async function filterTransactions(txs, smartAccountAddresses) {
    let filteredTransactions = [];
    for (const address of smartAccountAddresses) {
        const txsForAddress = filterTransactionsByAddressRecursive(txs, address);
        filteredTransactions.push(...txsForAddress);
    }
    return filteredTransactions;
}

async function simulateMultipleUsers(wallets, mode) {
    const blockNumberStart = await ethers.provider.getBlockNumber();
    for (let wallet of wallets) {
        await simulateSingleUser(wallet.secret, mode);
    }
    const blockNumberEnd = await ethers.provider.getBlockNumber();

    const allBlockData = await retrieveBlockRangeData(blockNumberStart, blockNumberEnd);
    const allTransactionHashes = getTransactionHashesFromBlocks(allBlockData);
    const allTransactionData = await getAllTransactionData(allTransactionHashes);

    // const walletsPath = path.join(__dirname, "wallets.json");
    // const wallets = getWalletsFromFile(walletsPath);
    const smartAccountAddresses = getAllSmartAccountAddresses(wallets);
    const filteredTransactions = await filterTransactions(allTransactionData, smartAccountAddresses);

    const attackerKnowledgePath = path.join(__dirname, "attacker_prior_knowledge.json");
    const attackerKnowledge = JSON.parse(fs.readFileSync(attackerKnowledgePath, "utf8"));
    const userContracts = identifyDeployedContracts(filteredTransactions, attackerKnowledge);
    const outputPath = path.join(__dirname, `user_contract_mapping_${mode}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(userContracts, null, 2));
    console.log(`User-to-contract mapping saved to ${outputPath}`);
    logToFile(`User-to-contract mapping saved to ${outputPath}`);
}

async function simulateMultipleUsersWithPrivacy(wallets) {
    await simulateMultipleUsers(wallets, "privacy");
}

async function simulateMultipleUsersWithStandard(wallets) {
    await simulateMultipleUsers(wallets, "standard");
}

async function main() {
    // const mode = "privacy"
    // const blockNumberStart = 20884500;
    // const blockNumberEnd = 20884900;

    const mode = "standard"
    const blockNumberStart = 20642700;
    const blockNumberEnd = 20642900;

    console.log("Retrieving block data...");
    // const allBlockData = await retrieveBlockRangeData(blockNumberStart, blockNumberEnd);
    const allBlockData = readAllBlockData(blockNumberStart, blockNumberEnd);
    console.log(`Read ${allBlockData.length} block data files.`);

    console.log("Retrieving transaction hashes...");
    const allTransactionHashes = getTransactionHashesFromBlocks(allBlockData);

    console.log("Retrieving transaction data...");
    // const allTransactionData = await getAllTransactionData(allTransactionHashes);
    const allTransactionData = readAllTransactionData(allTransactionHashes);
    console.log(`Read ${allTransactionData.length} transaction data files.`);

    const walletsPath = path.join(__dirname, "wallets.json");
    const wallets = getWalletsFromFile(walletsPath);

    console.log("getting smart account addresses...");
    const smartAccountAddresses = getAllSmartAccountAddresses(wallets);

    console.log("Filtering transactions...");
    const filteredTransactions = await filterTransactions(allTransactionData, smartAccountAddresses);

    console.log("get attacker knowledge...");
    const attackerKnowledgePath = path.join(__dirname, "attacker_prior_knowledge.json");
    const attackerKnowledge = JSON.parse(fs.readFileSync(attackerKnowledgePath, "utf8"));

    console.log("Identifying deployed contracts...");
    const userContracts = identifyDeployedContracts(filteredTransactions, attackerKnowledge);
    const outputPath = path.join(__dirname, `user_contract_mapping_${mode}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(userContracts, null, 2));
    console.log(`User-to-contract mapping saved to ${outputPath}`);
    logToFile(`User-to-contract mapping saved to ${outputPath}`);


}

// main().then(() => process.exit(0))
//     .catch(error => {
//         console.error(error);
//         logToFile(error.toString());
//         process.exit(1);
//     });

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            logToFile(error.toString());
            process.exit(1);
        });
}


module.exports = {
    simulateSingleUser,
    simulateMultipleUsersWithPrivacy,
    simulateMultipleUsersWithStandard,
    getSmartAccountAddress,
    getAllSmartAccountAddresses,
    getWalletsFromFile,
    filterTransactions
};