const path = require("path");
const snarkjs = require("snarkjs");
const merkleTree = require('fixed-merkle-tree');
const { setupHasher, hashLeftRight } = require('../scripts/utilities/hasher');
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

        const tree = new merkleTree.MerkleTree(2, [], { hashFunction: (left, right) => hashLeftRight(hasher, left, right) });

        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        const signer1 = signers[1];

        //address hash
        address0 = await signer0.getAddress();
        address32 = utils.address2Uint8Array32(address0)
        const addressHash = pedersen.hash(address32)

        // secret hash
        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretHash = pedersen.hash(secretBuff)

        // nullifier hash
        const nullifier = 0n;
        const nullifierHash = pedersen.hash(ffjavascript.utils.leInt2Buff(nullifier))

        const final = new Uint8Array(addressHash.length+secretHash.length+nullifierHash.length)
        final.set(addressHash,0)
        final.set(secretHash,32)
        final.set(nullifierHash,64)

        //final hash
        finalHash = pedersen.hash(final)
        const hP = babyJub.unpackPoint(finalHash);

        hp0 = F.toObject(hP[0])

        tree.insert(hp0)
        console.log("tree:", tree.elements)

        console.log(tree.proof(hp0))
        console.log(tree.root)

        // const input = {
        //     "root": "123456789",
        //     "nullifierHash": "987654321",
        //     "recipient": "100",
        //     "relayer": "50",
        //     "fee": "10",
        //     "refund": "5",
        //     "nullifier": "12345",
        //     "secret": "67890",
        //     "pathElements": ["0", "1", "2", "3"],
        //     "pathIndices": ["0", "1", "1", "0"],
        //     "smartContractWalletAddress": "111222333"
        // }

        // const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.plonk.fullProve(input, wasm, zkey);

        // console.log("Public Inputs:", publicInputs);
        // console.log("Proof:", proofJson);

    })
})