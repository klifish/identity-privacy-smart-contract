const fs = require('fs');
const path = require('path');

// Step 1: Load JSON files
const roles = JSON.parse(fs.readFileSync(path.join(__dirname, "..", 'role_merged_wallets.json')));
const transactions = JSON.parse(fs.readFileSync(path.join(__dirname, 'cache/enrichedTransactions.json')));
console.log(`Loaded ${transactions.length} transactions`);

// Step 2: Build a mapping from UserDataContract address to role
const contractToRole = {};
for (const roleEntry of roles) {
    const userDataContracts = roleEntry.deployedUserDataContractWithPrivacy;
    if (Array.isArray(userDataContracts)) {
        for (const userDataContract of userDataContracts) {
            const contractAddress = userDataContract.toLowerCase();
            contractToRole[contractAddress] = roleEntry.role;
        }
    }
}
console.log(`Mapped ${Object.keys(contractToRole).length} contracts to roles`);

// Step 3: Group transactions by role
const roleTransactions = {};
const roleSenders = {};

function collectRolesFromTransaction(tx, roleTransactions, contractToRole) {
    const visited = new Set();

    function extractAddressesRecursively(call) {
        if (!call || typeof call !== 'object') return;

        if (call.to) {
            const toAddr = call.to.toLowerCase();
            visited.add(toAddr);

            const role = contractToRole[toAddr];
            if (role) {
                if (!roleTransactions[role]) {
                    roleTransactions[role] = [];
                }
                roleTransactions[role].push(tx);

                if (!roleSenders[role]) {
                    roleSenders[role] = new Set();
                }
                if (call.from) {
                    roleSenders[role].add(call.from.toLowerCase());
                }
            }
        }

        if (Array.isArray(call.calls)) {
            for (const nestedCall of call.calls) {
                extractAddressesRecursively(nestedCall);
            }
        }
    }

    if (tx.to) {
        const toAddr = tx.to.toLowerCase();
        visited.add(toAddr);
        const role = contractToRole[toAddr];
        if (role) {
            if (!roleTransactions[role]) {
                roleTransactions[role] = [];
            }
            roleTransactions[role].push(tx);

            if (!roleSenders[role]) {
                roleSenders[role] = new Set();
            }
            if (tx.from) {
                roleSenders[role].add(tx.from.toLowerCase());
            }
        }
    }

    if (Array.isArray(tx.calls)) {
        for (const call of tx.calls) {
            extractAddressesRecursively(call);
        }
    }
}

transactions.forEach(tx => {
    collectRolesFromTransaction(tx, roleTransactions, contractToRole);
});

for (const [role, txs] of Object.entries(roleTransactions)) {
    console.log(`${role}: ${txs.length} transactions`);
}

// Step 4: Save or output results
fs.writeFileSync(path.join(__dirname, 'role_clustered_transactions.json'), JSON.stringify(roleTransactions, null, 2));
console.log('Clustering complete. Saved to role_clustered_transactions.json');

// Convert roleSenders Set values to arrays for JSON serialization
const serializedSenders = {};
for (const [role, senders] of Object.entries(roleSenders)) {
    serializedSenders[role] = Array.from(senders);
}

// Save role sender information to a file
fs.writeFileSync(path.join(__dirname, 'role_senders.json'), JSON.stringify(serializedSenders, null, 2));
console.log('Sender addresses saved to role_senders.json');