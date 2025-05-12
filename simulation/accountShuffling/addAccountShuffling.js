const fs = require("fs");
const path = require("path");

const { createSmartWallet } = require("../smartAccountManager")

function generateRandomSecret(length = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const inputPath = path.resolve(__dirname, "../wallets.json");
const outputPath = path.resolve(__dirname, "../wallets_with_shuffling.json");

const wallets = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

async function generateShufflingData() {
    const s1 = generateRandomSecret();
    const s2 = generateRandomSecret();
    return [
        {
            secret: s1,
            smartAccountAddress: await createSmartWallet(s1)
        },
        {
            secret: s2,
            smartAccountAddress: await createSmartWallet(s2)
        }
    ];
}

(async () => {
    for (const wallet of wallets) {
        wallet.accountShuffling = await generateShufflingData();
    }

    fs.writeFileSync(outputPath, JSON.stringify(wallets, null, 2));
    console.log("✅ accountShuffling field added and saved to wallets_with_shuffling.json");
})();