const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "data", "transactions", "allTransactionData.json");


function callTreeInvolvesAddress(call, target) {
    const fromMatch = call.from?.toLowerCase() === target;
    const toMatch = call.to?.toLowerCase() === target;

    if (fromMatch || toMatch) return true;

    if (call.calls && Array.isArray(call.calls)) {
        return call.calls.some(subcall => callTreeInvolvesAddress(subcall, target));
    }

    return false;
}

function filterTransactionsByAddressRecursive(transactions, address) {
    const target = address.toLowerCase();

    return transactions.filter(tx => {
        const result = tx.result;
        const fromMatch = result.from?.toLowerCase() === target;
        const toMatch = result.to?.toLowerCase() === target;

        const internalMatch = result.calls?.some(call => callTreeInvolvesAddress(call, target));

        return fromMatch || toMatch || internalMatch;
    });
}

async function main() {
    txs = JSON.parse(fs.readFileSync(dataPath));
    // Read wallets.json from simulation directory
    const walletsPath = path.join(__dirname, "wallets.json");
    const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
    const smartAccountAddresses = wallets.map(w => w.smartAccountAddress.toLowerCase());

    let filteredTransactions = [];
    for (const address of smartAccountAddresses) {
        const txsForAddress = filterTransactionsByAddressRecursive(txs, address);
        filteredTransactions.push(...txsForAddress);
    }
    
    const filteredDataPath = path.join(__dirname, "data", "transactions", "filteredTransactionData.json");
    fs.writeFileSync(filteredDataPath, JSON.stringify(filteredTransactions, null, 2));
    console.log(`Filtered transaction data written to ${filteredDataPath}`);
}

main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });