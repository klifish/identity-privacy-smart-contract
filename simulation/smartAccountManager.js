const { ethers } = require("hardhat");
const fs = require("fs");
const { computePedersenHash } = require("../scripts/utils");
const { createSmartAccount, getSender } = require('../scripts/userManagement/createSmartAccount');
const { calculateLeaf, registerUserWithLeaf } = require('../scripts/registerUser');
const { walletsFilePath } = require('./constants');

async function createAndRegisterSmartWallets() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    for (let wallet of wallets) {

        // create a smart wallet
        if (wallet.smartAccountAddress) {
            console.log("Smart account already exists for wallet:", wallet.address);
            continue;
        }

        address = await createSmartWallet(wallet.secret);
        wallet.smartAccountAddress = address

        // register a user
        await registerUserSmartWallet(wallet.secret, address);
    }
    fs.writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
    console.log("Updated wallets.json with smart account addresses.");
}

async function createSmartWallet(secret) {
    const commitment = await computePedersenHash(secret);
    const address = await getSender(commitment, 1);
    await createSmartAccount(commitment);
    return address;
}

async function registerUserSmartWallet(secret, address, nullifier = 0n) {
    const leafToInsert = await calculateLeaf(address, secret, nullifier);
    await registerUserWithLeaf(leafToInsert);
}

module.exports = {
    createAndRegisterSmartWallets,
    createSmartWallet,
    registerUserSmartWallet
};