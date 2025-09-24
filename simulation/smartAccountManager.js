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