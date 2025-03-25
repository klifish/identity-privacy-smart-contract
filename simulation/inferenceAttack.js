const { ethers } = require("hardhat");
const fs = require("fs");
const NUM_USERS = 10;
const { alchemyProvider, signer } = require('../scripts/constants');


function generateWallets(num_users) {
    const wallets = [];

    for (let i = 0; i < num_users; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push({
            index: i,
            address: wallet.address,
            privateKey: wallet.privateKey
        });
    }

    fs.writeFileSync("./simulation/wallets.json", JSON.stringify(wallets));
}

async function fund() {
    const wallets = JSON.parse(fs.readFileSync("./simulation/wallets.json"));

    for (let w of wallets) {
        const tx = await signer.sendTransaction({
            to: w.address,
            value: ethers.parseEther("0.1")
        });

        console.log(`Funded wallet ${w.index} at ${w.address} with 0.1 Token`);

        await tx.wait();
    }
}

async function deployUserDataContract() {
    const wallets = JSON.parse(fs.readFileSync("./simulation/wallets.json"));


    for (let w of wallets) {
        const signer_wallet = new ethers.Wallet(w.privateKey, alchemyProvider);
        const UserData = await ethers.getContractFactory("UserData", signer_wallet);
        const contract = await UserData.deploy();
        contract.waitForDeployment();

        console.log(`Deployed UserData contract for wallet ${w.index} at ${contract.target}`);
        break;
    }
}

async function main() {
    // generateWallets(NUM_USERS);
    // fund();
    await deployUserDataContract();
}

main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

