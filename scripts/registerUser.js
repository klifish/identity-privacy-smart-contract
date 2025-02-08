const path = require('path');
const ffjavascript = require('ffjavascript');
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.REGISTRY_CONTRACT_ADDRESS;
const ethers = require('ethers');
const hre = require("hardhat");
const utils = require("./utils")
const circomlibjs = require("circomlibjs")
const { hashLeftRight, setupHasher } = require("./utilities/hasher")
const merkleTree = require('fixed-merkle-tree');
const snarkjs = require("snarkjs");

const contract = require("../artifacts/contracts/MerkleRegistry.sol/MerkleRegistry.json");
const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

// const accountAddress = await signer.getAddress();
const secret = "secret";
const nullifier = 1n;
const merkleRegistryContract = new ethers.Contract(CONTRACT_ADDRESS, contract.abi, signer);

async function calculateLeaf(smart_account_address, secret, nullifier) {
    const secretBuff = (new TextEncoder()).encode(secret);
    const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff);

    const src = [smart_account_address, secretBigInt, nullifier];
    const srcHash = await utils.pedersenHashMultipleInputs(src);

    const babyjub = await circomlibjs.buildBabyjub();
    const hP = babyjub.unpackPoint(srcHash);
    const leaf = babyjub.F.toObject(hP[1]);

    return leaf;
}

async function registerUser(smart_account_address, secret, nullifier) {
    // const accountAddress = await signer.getAddress();

    // const babyjub = await circomlibjs.buildBabyjub();
    // const levels = await merkleRegistryContract.getLevels();
    // console.log("The levels is: " + levels);

    // const secretBuff = (new TextEncoder()).encode(secret);
    // const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff);


    // const src = [accountAddress, secretBigInt, nullifier];
    // const leaf = await utils.pedersenHashMultipleInputs(src);
    // console.log("The leaf is: " + leaf);
    // const hP = babyjub.unpackPoint(leaf);
    // hp1 = babyjub.F.toObject(hP[1]);
    const leafToInsert = calculateLeaf(smart_account_address, secret, nullifier);

    const tx = await merkleRegistryContract.registerUser(leafToInsert);
    await tx.wait();
    console.log("User registered");
}

async function generateProof(smart_account_address, secret, nullifier) {
    let wasm = path.join(__dirname, "..", "build", "circuits", "register_js", "register.wasm");
    let zkey = path.join(__dirname, "..", "build", "circuits", "register_final.zkey");

    const leafToInsert = await calculateLeaf(smart_account_address, secret, nullifier);
    console.log("The leaf to insert is: " + leafToInsert);

    const hasher = await setupHasher();
    const events = await merkleRegistryContract.queryFilter("UserRegistered");
    const sortedEvents = events.sort((a, b) => (a.args.index < b.args.index ? -1 : a.args.index > b.args.index ? 1 : 0));
    const leafs = sortedEvents.map(event => event.args.leaf);
    console.log("The leafs are: " + leafs);

    const treeOffChain = new merkleTree.MerkleTree(MERKLE_TREE_LEVEL, leafs, { hashFunction: (left, right) => hashLeftRight(hasher, left, right) });

    const root = treeOffChain.proof(leafToInsert).pathRoot;
    const { pathElements, pathIndices } = treeOffChain.proof(leafToInsert)
    const secretBuff = (new TextEncoder()).encode(secret);
    const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff);

    const input = {
        "root": root,
        "nullifierHash": "987654321",
        "recipient": "100",
        "relayer": "50",
        "fee": "10",
        "refund": "5",
        "nullifier": nullifier,
        "secret": secretBigInt,
        "pathElements": pathElements,
        "pathIndices": pathIndices,
        "smartContractWalletAddress": smart_account_address
    }

    console.log("start proving")

    const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.plonk.fullProve(input, wasm, zkey);
    console.log("prove done")

    const parsedproof = utils.parseProof(proofJson);

    const proofBigint = parsedproof.map((el) => BigInt(el));
    const publicSignalsBigint = publicInputs.map((el) => BigInt(el));

    const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint256[24]", "uint256[2]"], [proofBigint, publicSignalsBigint]);

    return [serializedProofandPublicSignals, parsedproof, publicInputs];

}

module.exports = {
    calculateLeaf,
    registerUser,
    generateProof
}
// async function main() {
//     await generateProof();
// }

// main().then(() => process.exit(0)).catch(error => {
//     console.error(error);
//     process.exit(1);
// });