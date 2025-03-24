const path = require("path");
const snarkjs = require("snarkjs");
const merkleTree = require('fixed-merkle-tree');
const { setupHasher, hashLeftRight, hashLeftRightNew } = require('../scripts/utilities/hasher');
const utils = require('../scripts/utils')
const { ethers } = require("hardhat");
const circomlibjs = require("circomlibjs")
const ffjavascript = require("ffjavascript")
const circomlib = require("circomlib")

describe('Register Circuit', function () {
    let wasm
    let zkey
    let hasher
    let pedersen;
    let babyJub;
    let F

    before(async function () {
        hasher = await setupHasher();
        babyJub = await circomlibjs.buildBabyjub();
        F = babyJub.F;

        pedersen = await circomlibjs.buildPedersenHash();
        babyjub = await circomlibjs.buildBabyjub();
    });

    it("Should be able to verify a proof", async () => {
        wasm = path.join(__dirname, "..", "build", "circuits", "register_js", "register.wasm");
        zkey = path.join(__dirname, "..", "build", "circuits", "register_final.zkey");

        const tree = new merkleTree.MerkleTree(20, [], { hashFunction: (left, right) => hashLeftRightNew(hasher, left, right) });

        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        address0 = await signer0.getAddress();

        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        // nullifier hash
        const nullifier = 1n;

        const src = [address0, secretBigInt, nullifier]
        finalHash = await utils.pedersenHashMultipleInputs(src)
        const hP = babyJub.unpackPoint(finalHash);
        hp1 = F.toObject(hP[1])

        tree.insert(hp1)
        const root = tree.root
        const { pathElements, pathIndices } = tree.proof(hp1)

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
            "smartContractWalletAddress": address0
        }
        console.log("start proving")

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve(input, wasm, zkey);
        console.log("proof: ", proofJson)
        console.log("publicSignals: ", publicInputs)
        console.log("prove done")

    })
})