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

        const tree = new merkleTree.MerkleTree(2, [], { hashFunction: (left, right) => hashLeftRightNew(hasher, left, right) });

        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        const signer1 = signers[1];

        //address hash
        address0 = await signer0.getAddress();
        addressBits0 = utils.numToBits(BigInt(address0), 256)

        address32 = utils.address2Uint8Array32(address0)

        const addressHash = pedersen.hash(address32)
        const addressHashPoint = babyJub.unpackPoint(addressHash)
        const addressHashPoint0 = F.toObject(addressHashPoint[0])
        

        // secret hash
        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)
        const secretBits = utils.numToBits(secretBigInt, 256)
        const secretHash = pedersen.hash(secretBuff)

        // nullifier hash
        const nullifier = 0n;
        const nullifierBits = utils.numToBits(nullifier, 256)
        const nullifierHash = pedersen.hash(ffjavascript.utils.leInt2Buff(nullifier))

        const final = new Uint8Array(addressHash.length + secretHash.length + nullifierHash.length)
        final.set(addressHash, 0)
        final.set(secretHash, 32)
        final.set(nullifierHash, 64)

        const finalBits = addressBits0.concat(secretBits).concat(nullifierBits)
        // console.log("Final Bits:", finalBits);
        const finalBigInt = utils.bitsToNum(finalBits)
        // console.log("Final BigInt:", finalBigInt);

        //final hash
        finalBuff = pedersen.buffer2bits(ffjavascript.utils.leInt2Buff(finalBigInt))
        // console.log("finalBuff:", finalBuff);
        finalHash = pedersen.hash(ffjavascript.utils.leInt2Buff(finalBigInt))

        const src = [address0, secretBigInt, nullifier]
        finalHash = await utils.pedersenHashMultipleInputs(src)
        // console.log("Result:", finalHash);
        const hP = babyJub.unpackPoint(finalHash);

        hp0 = F.toObject(hP[0])
        console.log("hp0:", hp0);
        hp1 = F.toObject(hP[1])
        console.log("hp1:", hp1);



        tree.insert(hp1)
        const root = tree.root
        // console.log("tree.serialize", tree.serialize())
        const { pathElements, pathIndices } = tree.proof(hp1)

        const input = {
            "root": root,
            "nullifierHash": "987654321",
            "recipient": "100",
            "relayer": "50",
            "fee": "10",
            "refund": "5",
            "nullifier": 0n,
            "secret": secretBigInt,
            "pathElements": pathElements,
            "pathIndices": pathIndices,
            "smartContractWalletAddress": address0
        }
        // const input = {
        //     "nullifier": 0n,
        //     "secret": secretBigInt,
        //     "smartContractWalletAddress": address0
        // }

        // console.log("Tree Root:", tree.root);
        // // console.log("Leaf (hp0):", hp0);
        // console.log("Path Elements:", pathElements);
        // console.log("Path Indices:", pathIndices);

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.plonk.fullProve(input, wasm, zkey);

        console.log("Public Inputs:", publicInputs);
        // console.log("Proof:", proofJson);

    })
})