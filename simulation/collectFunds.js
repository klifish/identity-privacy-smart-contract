const { ethers } = require("hardhat");
const fs = require("fs");
const { alchemyProvider, signer } = require('../scripts/constants');

const walletsFilePath = "./simulation/wallets.json";

// 🏦 Set your recipient address here (where to collect the funds)
const recipient = "0xe1249c0ED30dE2EEf273ce84813C6fd54aBA58Fc"; // <-- replace this!

const gasLimit = 21000; // standard for simple ETH transfers

async function sweepAllBalances() {
    const provider = alchemyProvider;
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));

    for (let w of wallets) {
        const wallet = new ethers.Wallet(w.privateKey, provider);
        const balance = await provider.getBalance(wallet.address);

        if (balance > 0n) {
            const gasPrice = await provider.getFeeData().then(feeData => feeData.gasPrice);
            const gasCost = gasPrice * BigInt(gasLimit);

            if (balance > gasCost) {
                const amountToSend = balance - gasCost;

                const tx = await wallet.sendTransaction({
                    to: recipient,
                    value: amountToSend,
                    gasPrice: gasPrice,
                    gasLimit: gasLimit
                });

                console.log(`Wallet ${w.index} (${wallet.address}) sent ${ethers.formatEther(amountToSend)} ETH → ${recipient}`);
                await tx.wait();
            } else {
                console.log(`Wallet ${w.index} (${wallet.address}) has insufficient balance to cover gas.`);
            }
        } else {
            console.log(`Wallet ${w.index} (${wallet.address}) has zero balance.`);
        }
    }
}

sweepAllBalances().catch(console.error);