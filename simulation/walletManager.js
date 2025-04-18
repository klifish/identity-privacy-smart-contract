const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const NUM_USERS = 10;
const { alchemyProvider, signer } = require('../scripts/constants');
const { getCommitmentVerifierAddress, getVerifyingPaymsaterAddress, getFirstRunnerAddress } = require('../scripts/isDeployed');
const { computePedersenHash, groth16ExportSolidityCallData } = require("../scripts/utils");
const { createSmartAccount, getSender } = require('../scripts/userManagement/createSmartAccount');
const { calculateLeaf, registerUserWithLeaf, generateProof } = require('../scripts/registerUser');
const { getUserOpHash, getDefaultUserOp, getCallData, fillUserOp, packUserOp } = require('../scripts/userOp');
const ffjavascript = require("ffjavascript");
const { ZeroAddress } = require("ethers");
const { c } = require("circom_tester");
const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;

const MOCK_VALID_UNTIL = '0x00000000deadbeef'
const MOCK_VALID_AFTER = '0x0000000000001234'
const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT;

const wasm = path.join(__dirname, "..", "build", "circuits", "commitment_js", "commitment.wasm");
const zkey = path.join(__dirname, "..", "build", "circuits", "commitment_final.zkey");



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

        const balance = await alchemyProvider.getBalance(w.address);

        console.log(`Funded wallet ${w.index} at ${w.address} with 0.1 Token and balance is ${ethers.formatEther(balance)}`);

        await tx.wait();
    }
}