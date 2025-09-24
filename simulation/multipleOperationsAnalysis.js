const path = require("path");
const fs = require("fs");

const {
    retrieveBlockRangeData,
    readAllBlockData,
    getTransactionHashesFromBlocks,
    getAllTransactionData,
    readAllTransactionData,
} = require("./retrieveBlockData");

const {
    getWalletsFromFile,
    getAllSmartAccountAddresses,
    filterTransactions,
} = require("./user");

const { identifyDeployedContracts } = require("./inferenceAttack");
// ---- persistent log file ----
const LOG_PATH = "./simulation/replay.log";
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    logStream.write(line + "\n");
}

async function main() {
    const mode = "standard"; // or "privacy"
    const startBlockNumber = 21488000;
    const endBlockNumber = 21488500;

    // Retrieve block data for the specified range
    // const blockData = await retrieveBlockRangeData(startBlockNumber, endBlockNumber);
    const allBlockData = readAllBlockData(startBlockNumber, endBlockNumber);
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

    console.log("filtered transactions...", filteredTransactions.length);

    console.log("get attacker knowledge...");
    const attackerKnowledgePath = path.join(__dirname, "attacker_prior_knowledge.json");
    const attackerKnowledge = JSON.parse(fs.readFileSync(attackerKnowledgePath, "utf8"));

    console.log("Identifying deployed contracts...");
    const userContracts = identifyDeployedContracts(filteredTransactions, attackerKnowledge);
    const outputPath = path.join(__dirname, `multi_user_contract_mapping_${mode}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(userContracts, null, 2));
    console.log(`User-to-contract mapping saved to ${outputPath}`);
    log(`User-to-contract mapping saved to ${outputPath}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });