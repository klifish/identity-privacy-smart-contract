const { ethers } = require("hardhat");
const fs = require("fs");
const { alchemyProvider, signer } = require('../scripts/constants');
const { walletsFilePath } = require('./constants');

function generateWallets(num_users) {

    if (fs.existsSync(walletsFilePath)) {
        console.log("wallets.json already exists. Aborting wallet generation to avoid overwriting.");
        console.log("If you want to regenerate the wallets, please delete the existing wallets.json file.");
        return;
    }
    const wallets = [];

    for (let i = 0; i < num_users; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push({
            index: i,
            address: wallet.address,
            privateKey: wallet.privateKey
        });
    }

    fs.writeFileSync(walletsFilePath, JSON.stringify(wallets));
}

function generateSecrets() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    let updated = false;
    for (let wallet of wallets) {

        if (!wallet.secret) {
            const secret = "secret" + wallet.index;
            wallet.secret = secret;
            updated = true;
        }
    }

    if (updated) {
        fs.writeFileSync(walletsFilePath, JSON.stringify(wallets));
        console.log("Secrets generated and saved to wallets.json");
    } else {
        console.log("Secrets already exist. No changes made.");
    }
}

async function fund() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));

    for (let w of wallets) {
        const tx = await signer.sendTransaction({
            to: w.address,
            value: ethers.parseEther("0.1")
        });

        const balance = await alchemyProvider.getBalance(w.address);

        console.log(`Funded wallet ${w.index} at ${w.address} with 0.1 Token and balance is ${ethers.formatEther(balance)}`);

        await tx.wait();
    }
}