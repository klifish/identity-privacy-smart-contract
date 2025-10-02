const { getUserOperationByHash } = require('./transactionGraph');
const { alchemyProvider } = require('../scripts/constants');
const { BUNDLER_URL, ENTRY_POINT_V07_ADDRESS } = require('./constants');

/**
 * Wait for user operation to be packed and return txHash
 * @param {string} userOpHash - The user operation hash
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<string>} - The transaction hash
 */
async function waitForUserOperationToBePacked(userOpHash, maxAttempts = 20, delayMs = 3000) {
    for (let i = 0; i < maxAttempts; i++) {
        const txHash = await getUserOperationByHash(userOpHash);
        if (txHash) return txHash;
        console.log(`⏳ Waiting for bundler to process UserOperation... (attempt ${i + 1})`);
        await new Promise((res) => setTimeout(res, delayMs));
    }
    throw new Error("❌ Timeout: UserOperation was not packed by bundler.");
}

/**
 * Wait for transaction to be mined and return receipt
 * @param {string} txHash - The transaction hash
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<Object|null>} - The transaction receipt or null
 */
async function waitForTransactionToBeMined(txHash, maxAttempts = 20, delayMs = 3000) {
    let receipt = null;
    let attempts = 0;

    while (!receipt && attempts < maxAttempts) {
        receipt = await alchemyProvider.getTransactionReceipt(txHash);
        if (receipt && receipt.blockNumber) {
            console.log("✅ Transaction included in block:", receipt.blockNumber);
            return receipt;
        }
        console.log(`⏳ Waiting for transaction to be mined... (attempt ${attempts + 1})`);
        await new Promise((res) => setTimeout(res, delayMs));
        attempts++;
    }

    console.log("❌ Transaction not mined after waiting period.");
    return null;
}

/**
 * Send user operation to bundler
 * @param {Object} userOp - The user operation to send
 * @returns {Promise<Object>} - The bundler response data
 */
async function sendUserOperationToBundler(userOp) {
    const options = {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_sendUserOperation',
            params: [userOp, ENTRY_POINT_V07_ADDRESS]
        })
    };

    const response = await fetch(BUNDLER_URL, options);
    const data = await response.json();

    if (data.error) {
        const errMsg = `Bundler Error: ${data.error.message || 'Unknown error'} - ${data.error.data?.reason || 'No reason provided'}`;
        throw new Error(errMsg);
    }

    return data;
}

module.exports = {
    waitForUserOperationToBePacked,
    waitForTransactionToBeMined,
    sendUserOperationToBundler
};
