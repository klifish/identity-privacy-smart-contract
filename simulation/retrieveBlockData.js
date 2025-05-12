const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const { getTransactionByHash } = require('./transactionGraph');

async function retrieveBlockRangeData(startBlock, endBlock) {
    const allBlockData = [];
    try {
        console.log(`Start retrieving block data from ${startBlock} to ${endBlock}`);
        for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
            console.log(`Retrieving data for block number: ${blockNumber}`);
            const blockData = await retrieveBlockData(blockNumber);
            // console.log(`Data for block number ${blockNumber} retrieved successfully.`);
            allBlockData.push(blockData);
        }
    } catch (err) {
        console.error('Error retrieving block range data:', err);
    }
    console.log(`Finished retrieving block data from ${startBlock} to ${endBlock}`);
    return allBlockData;
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
        return blockData;
    } catch (err) {
        console.error('Error retrieving block data:', err);
        throw err;
    }

}

function readAllBlockData(blockNumberStart, blockNumberEnd) {
    const dataDir = path.join(__dirname, "data");
    const files = fs.readdirSync(dataDir)
        .filter(file => file.endsWith(".json"))
        .filter(file => {
            const match = file.match(/blockData_(\d+)\.json/);
            if (match) {
                const blockNumber = parseInt(match[1], 10);
                return blockNumber >= blockNumberStart && blockNumber <= blockNumberEnd;
            }
            return false;
        });
    const allBlockData = files.map(file => {
        const content = fs.readFileSync(path.join(dataDir, file), "utf-8");
        return JSON.parse(content);
    });
    console.log(`Read ${allBlockData.length} block data files.`);
    return allBlockData;
}

function readAllTransactionDataWithTimestamp(txHashesWithTimestamp = null) {
    const dataDir = path.join(__dirname, "data", "transactions");

    const txHashSet = txHashesWithTimestamp ? new Set(txHashesWithTimestamp.map(tx => tx.txHash)) : null;
    const hashToTimestamp = {};
    if (txHashesWithTimestamp) {
        for (const tx of txHashesWithTimestamp) {
            hashToTimestamp[tx.txHash] = {
                timestamp: tx.timestamp,
                blockNumber: tx.blockNumber
            };
        }
    }

    const files = fs.readdirSync(dataDir)
        .filter(file => file.endsWith(".json"))
        .filter(file => {
            if (!txHashSet) return true;
            const match = file.match(/^(.+)\.json$/);
            if (match) {
                const txHash = match[1];
                return txHashSet.has(txHash);
            }
            return false;
        });

    const allTransactionData = files.map(file => {
        const content = fs.readFileSync(path.join(dataDir, file), "utf-8");
        const txData = JSON.parse(content);
        const txHash = path.basename(file, ".json");
        txData.txHash = txHash;
        if (hashToTimestamp[txHash]) {
            txData.timestamp = hashToTimestamp[txHash].timestamp;
            txData.blockNumber = hashToTimestamp[txHash].blockNumber;
        }
        return txData;
    });
    console.log(`Read ${allTransactionData.length} transaction data files.`);
    return allTransactionData;
}

function readAllTransactionData(txHashes = null) {
    const dataDir = path.join(__dirname, "data", "transactions");
    const files = fs.readdirSync(dataDir)
        .filter(file => file.endsWith(".json"))
        .filter(file => {
            if (!txHashes) return true;
            const match = file.match(/^(.+)\.json$/);
            if (match) {
                const txHash = match[1];
                return txHashes.includes(txHash);
            }
            return false;
        });
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
        // console.log(`Processing block data for block number: ${data.block.number}`);
        if (data.block && Array.isArray(data.block.transactions)) {
            txHashes.push(...data.block.transactions);
        }
    }
    console.log(`Extracted ${txHashes.length} transaction hashes from blocks.`);
    return txHashes;
}

function getTransactionHashesFromBlocksWithTimestamp(blockDataArray) {
    const txDetails = [];
    for (const data of blockDataArray) {
        if (data.block && Array.isArray(data.block.transactions)) {
            const { number: blockNumber, timestamp } = data.block;
            for (const txHash of data.block.transactions) {
                txDetails.push({
                    txHash,
                    blockNumber,
                    timestamp
                });
            }
        }
    }
    console.log(`Extracted ${txDetails.length} transactions with timestamp from blocks.`);
    return txDetails;
}

async function getAllTransactionData(txHashes) {
    const allTransactionData = [];
    for (const hash of txHashes) {
        console.log(`Tracing transaction ${hash}`);
        const transactionData = await getTransactionByHash(hash, `${hash}.json`);
        allTransactionData.push(transactionData);
    }
    return allTransactionData;
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

if (require.main === module) {
    main().then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    retrieveBlockRangeData,
    retrieveBlockData,
    readAllBlockData,
    readAllTransactionData,
    getTransactionHashesFromBlocks,
    getAllTransactionData,
    getTransactionHashesFromBlocksWithTimestamp,
    readAllTransactionDataWithTimestamp
};