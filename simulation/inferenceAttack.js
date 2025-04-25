const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const walletsFilePath = "./simulation/wallets.json";

function generateAttackerPriorKnowledge() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath, "utf8"));

    const attackerKnowledge = {};
    wallets.forEach((wallet, index) => {
        attackerKnowledge[`user_${index}`] = wallet.smartAccountAddress;
    });

    const priorOutputPath = path.join(__dirname, "attacker_prior_knowledge.json");
    fs.writeFileSync(priorOutputPath, JSON.stringify(attackerKnowledge, null, 2));
    console.log("✅ Attacker prior knowledge saved to", priorOutputPath);
}

function identifyDeployedContracts(txs, attackerKnowledge) {


    const userContracts = {};
    Object.entries(attackerKnowledge).forEach(([user, address]) => {
        userContracts[user] = [];
    });

    function traverseInternalCalls(calls, attackerKnowledge, userContracts) {
        if (!Array.isArray(calls)) return;

        calls.forEach(call => {
            if ((call.type === "CREATE" || call.type === "CREATE2") && call.from && call.to) {
                const internalFrom = call.from.toLowerCase();
                const matchedInternal = Object.entries(attackerKnowledge).find(
                    ([, addr]) => addr.toLowerCase() === internalFrom
                );
                if (matchedInternal) {
                    const [user] = matchedInternal;
                    userContracts[user].push(call.to);
                }
            }
            if (call.calls) {
                traverseInternalCalls(call.calls, attackerKnowledge, userContracts);
            }
        });
    }

    txs.forEach(tx => {
        if (tx.result && tx.result.from) {
            const calls = tx.result.calls || [];
            traverseInternalCalls(calls, attackerKnowledge, userContracts);
        }
    });

    const outputPath = path.join(__dirname, "user_contract_mapping.json");
    fs.writeFileSync(outputPath, JSON.stringify(userContracts, null, 2));
    console.log("✅ User-to-contract mapping saved to", outputPath);
}

async function main() {
    const attackerKnowledgePath = path.join(__dirname, "attacker_prior_knowledge.json");
    const attackerKnowledge = JSON.parse(fs.readFileSync(attackerKnowledgePath, "utf8"));

    const txDataPath = path.join(__dirname, "data", "transactions", "filteredTransactionData.json");
    const txs = JSON.parse(fs.readFileSync(txDataPath, "utf8"));
    // generateAttackerPriorKnowledge();
    identifyDeployedContracts(txs, attackerKnowledge);
}

main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

module.exports = {
    generateAttackerPriorKnowledge,
    identifyDeployedContracts
};