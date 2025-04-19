const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

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

async function main() {

    const startBlockNumber = 20642700
    const endBlockNumber = 20642900
    for (let blockNumber = startBlockNumber; blockNumber <= endBlockNumber; blockNumber++) {
        console.log(`Retrieving data for block number: ${blockNumber}`);
        // Retrieve block data
        await retrieveBlockData(blockNumber);
        console.log(`Data for block number ${blockNumber} retrieved successfully.`);
    }
}
main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });