const { ethers } = require("hardhat");
const fs = require("fs");
const NUM_USERS = 10;
const { alchemyProvider, signer } = require('../scripts/constants');

const walletsFilePath = "./simulation/wallets.json";


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

        console.log(`Funded wallet ${w.index} at ${w.address} with 0.1 Token`);

        await tx.wait();
    }
}

async function deployUserDataContractTraditional() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));


    for (let w of wallets) {
        const signer_wallet = new ethers.Wallet(w.privateKey, alchemyProvider);
        const UserData = await ethers.getContractFactory("UserData", signer_wallet);

        const secret = w.secret;
        const commitment = await computePedersenHash(secret);
        const contract = await UserData.deploy();
        contract.waitForDeployment();

        console.log(`Deployed UserData contract for wallet ${w.index} at ${contract.target}`);
        break;
    }
}

async function main() {
    // generateWallets(NUM_USERS);
    // generateSecrets();
    // fund();
    await deployUserDataContractTraditional();
}

main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

