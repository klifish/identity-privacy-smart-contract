

const fs = require("fs");
const path = require("path");

// Load inputs
const wallets = JSON.parse(fs.readFileSync(path.join(__dirname, "../wallets_with_shuffling.json"), "utf-8"));
const traceLines = fs.readFileSync(path.join(__dirname, "../trace_features.jsonl"), "utf-8").split("\n").filter(Boolean);

// Build uid => role mapping
const uidToRole = {};
for (const line of traceLines) {
    const record = JSON.parse(line);
    if (record.uid !== undefined && record.role) {
        uidToRole[record.uid] = record.role;
    }
}

// Group addresses by role, including secrets
const roleToAddresses = {};

wallets.forEach(wallet => {
    const role = uidToRole[wallet.index];
    if (!role) return;

    if (!roleToAddresses[role]) {
        roleToAddresses[role] = [];
    }

    if (wallet.smartAccountAddress && wallet.secret) {
        roleToAddresses[role].push({
            smartAccountAddress: wallet.smartAccountAddress.toLowerCase(),
            secret: wallet.secret
        });
    }

    (wallet.accountShuffling || []).forEach(shuffled => {
        if (shuffled.smartAccountAddress && shuffled.secret) {
            roleToAddresses[role].push({
                smartAccountAddress: shuffled.smartAccountAddress.toLowerCase(),
                secret: shuffled.secret
            });
        }
    });
});

// Format output
const merged = Object.entries(roleToAddresses).map(([role, addresses]) => ({
    role,
    addresses
}));

fs.writeFileSync(path.join(__dirname, "role_merged_wallets.json"), JSON.stringify(merged, null, 2));
console.log("✅ role_merged_wallets.json generated.");