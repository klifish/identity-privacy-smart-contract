const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const { getTransactionByHash } = require('./transactionGraph');
const { all } = require("express/lib/application");

async function retrieveBlockRangeData(startBlock, endBlock) {
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
        console.log(`Retrieving data for block number: ${blockNumber}`);
        await retrieveBlockData(blockNumber);
        console.log(`Data for block number ${blockNumber} retrieved successfully.`);
    }
}

async function retrieveBlockData(blockNumber) {
    try {
        const block = await ethers.provider.getBlock(blockNumber);
        const transactions = await Promise.all(block.transactions.map(tx => ethers.provider.getTransaction(tx)));
        const transactionReceipts = await Promise.all(transactions.map(tx => ethers.provider.getTransactionReceipt(tx.hash)));

        const blockData = {
            block,
            transactions,
            transactionReceipts
        };

        fs.writeFileSync(path.join(__dirname, "data", `blockData_${blockNumber}.json`), JSON.stringify(blockData, null, 2));
        console.log(`Block data for block ${blockNumber} saved to blockData_${blockNumber}.json`);
    } catch (err) {
        console.error('Error retrieving block data:', err);
    }
}

function readAllBlockData() {
    const dataDir = path.join(__dirname, "data");
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith(".json"));
    const allBlockData = files.map(file => {
        const content = fs.readFileSync(path.join(dataDir, file), "utf-8");
        return JSON.parse(content);
    });
    console.log(`Read ${allBlockData.length} block data files.`);
    return allBlockData;
}

function readAllTransactionData() {
    const dataDir = path.join(__dirname, "data", "transactions");
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith(".json"));
    const allTransactionData = files.map(file => {
        const content = fs.readFileSync(path.join(dataDir, file), "utf-8");
        return JSON.parse(content);
    });
    console.log(`Read ${allTransactionData.length} transaction data files.`);
    return allTransactionData;
}

function getTransactionHashesFromBlocks(blockDataArray) {
    const txHashes = [];
    for (const data of blockDataArray) {
        if (data.block && Array.isArray(data.block.transactions)) {
            txHashes.push(...data.block.transactions);
        }
    }
    console.log(`Extracted ${txHashes.length} transaction hashes from blocks.`);
    return txHashes;
}

async function getAllTransactionData(txHashes) {
    // const allTransactionData = readAllTransactionData();
    // const txHashes = getTransactionHashesFromBlocks(allTransactionData);

    for (const hash of txHashes) {
        console.log(`Tracing transaction ${hash}`);
        await getTransactionByHash(hash, `${hash}.json`);
    }
}

async function main() {
    const startBlockNumber = 20642700;
    const endBlockNumber = 20642900;

    // const allBlockData = readAllBlockData();
    // const txHashes = getTransactionHashesFromBlocks(allBlockData);
    // await getAllTransactionData(txHashes);

    const allTransactionData = readAllTransactionData();
    const outputPath = path.join(__dirname, "data", "transactions", "allTransactionData.json");
    fs.writeFileSync(outputPath, JSON.stringify(allTransactionData, null, 2));
    console.log(`All transaction data written to ${outputPath}`);
}
main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });