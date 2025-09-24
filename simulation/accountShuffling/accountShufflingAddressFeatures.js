const {
    retrieveBlockRangeData,
    readAllBlockData,
    getTransactionHashesFromBlocks,
    getAllTransactionData,
    readAllTransactionData,
    getTransactionHashesFromBlocksWithTimestamp,
    readAllTransactionDataWithTimestamp
} = require("../retrieveBlockData");

const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");
fs.mkdirSync(CACHE_DIR, { recursive: true });

async function loadOrRetrieveBlockData(startBlockNumber, endBlockNumber) {
    const cachePath = path.join(CACHE_DIR, `blockData-${startBlockNumber}-${endBlockNumber}.json`);
    if (fs.existsSync(cachePath)) {
        console.log("📦 Loading block data from cache...");
        return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    }

    console.log("🌐 Fetching block data from remote...");
    const blockData = await retrieveBlockRangeData(startBlockNumber, endBlockNumber);
    fs.writeFileSync(cachePath, JSON.stringify(blockData, null, 2));
    return blockData;
}

async function loadOrRetrieveTransactionData(allTransactionHashes) {
    const cachePath = path.join(CACHE_DIR, `transactionData.json`);
    if (fs.existsSync(cachePath)) {
        console.log("📦 Loading transaction data from cache...");
        return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    }

    console.log("🌐 Fetching transaction data from remote...");
    const txData = await getAllTransactionData(allTransactionHashes);
    fs.writeFileSync(cachePath, JSON.stringify(txData, null, 2));
    return txData;
}

async function main() {
    const mode = "standard"; // or "privacy"
    const startBlockNumber = 21615400

    const endBlockNumber = 21617200

    const allBlockData = await loadOrRetrieveBlockData(startBlockNumber, endBlockNumber);

    console.log("Retrieving transaction hashes...");
    const allTransactionHashes = getTransactionHashesFromBlocksWithTimestamp(allBlockData);

    console.log("Retrieving transaction data...");
    const allTransactionData = await loadOrRetrieveTransactionData(allTransactionHashes);


    const hashToTimestamp = {};
    for (const tx of allTransactionHashes) {
        hashToTimestamp[tx.txHash] = {
            timestamp: tx.timestamp,
            blockNumber: tx.blockNumber
        };
    }

    for (const tx of allTransactionData) {

        const extra = hashToTimestamp[tx.txHash];
        if (extra) {
            tx.timestamp = extra.timestamp;
            tx.blockNumber = extra.blockNumber;
        }
    }

    // Write enriched transactions to file
    fs.writeFileSync(path.join(__dirname, "cache", "enrichedTransactions.json"), JSON.stringify(allTransactionData, null, 2));
    console.log("✅ enrichedTransactions.json exported.");

    // check entrypoint 
    const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032".toLowerCase();
    const entrypointTransactions = allTransactionData.filter(
        tx => tx.to?.toLowerCase() === ENTRYPOINT_ADDRESS
    );
    // fs.writeFileSync(path.join(__dirname, "cache", "entrypointTransactions.json"), JSON.stringify(entrypointTransactions, null, 2));
    // console.log("✅ entrypointTransactions.json exported.");

    // --- Temporal feature computation per address ---
    const addressToTimestamps = {};

    function collectInternalFromAddresses(calls, timestamp) {
        for (const call of calls) {
            const internalFrom = call.from?.toLowerCase();
            if (internalFrom) {
                if (!addressToTimestamps[internalFrom]) {
                    addressToTimestamps[internalFrom] = [];
                }
                addressToTimestamps[internalFrom].push(timestamp);
            }
            if (call.calls && Array.isArray(call.calls)) {
                collectInternalFromAddresses(call.calls, timestamp);
            }
        }
    }


    for (const tx of entrypointTransactions) {
        const topLevelFrom = tx.from.toLowerCase();
        if (!addressToTimestamps[topLevelFrom]) {
            addressToTimestamps[topLevelFrom] = [];
        }
        addressToTimestamps[topLevelFrom].push(tx.timestamp);

        if (tx.calls && Array.isArray(tx.calls)) {
            collectInternalFromAddresses(tx.calls, tx.timestamp);
        }
    }

    console.log(`Extracted ${Object.keys(addressToTimestamps).length} unique addresses with timestamps.`);

    const addressFeatures = {};
    for (const [address, timestamps] of Object.entries(addressToTimestamps)) {
        timestamps.sort((a, b) => a - b);
        const n = timestamps.length;
        const gaps = [];
        for (let i = 1; i < n; i++) {
            gaps.push(timestamps[i] - timestamps[i - 1]);
        }

        const duration = timestamps[n - 1] - timestamps[0];
        const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length || 0;
        const stdGap = Math.sqrt(gaps.map(x => (x - meanGap) ** 2).reduce((a, b) => a + b, 0) / (gaps.length || 1));

        // Activity vector over 10 buckets
        const buckets = 10;
        const activityVector = Array(buckets).fill(0);
        const interval = duration / buckets || 1;
        for (const ts of timestamps) {
            const idx = Math.min(Math.floor((ts - timestamps[0]) / interval), buckets - 1);
            activityVector[idx]++;
        }

        addressFeatures[address] = {
            n_tx: n,
            duration,
            mean_time_gap: meanGap,
            std_time_gap: stdGap,
            activity_vector: activityVector
        };
    }

    // Print address feature vectors
    // for (const [addr, feat] of Object.entries(addressFeatures)) {
    //     console.log(addr, [
    //         feat.n_tx,
    //         feat.duration,
    //         feat.mean_time_gap,
    //         feat.std_time_gap,
    //         ...feat.activity_vector
    //     ]);
    // }

    fs.writeFileSync(require("path").join(__dirname, "addressFeatures.json"), JSON.stringify(addressFeatures, null, 2));
    console.log("✅ addressFeatures.json exported.");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });