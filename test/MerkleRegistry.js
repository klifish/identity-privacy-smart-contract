const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const assert = require('assert');
const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");
const merkleTree = require('fixed-merkle-tree');
const { setupHasher, hashLeftRight } = require('../scripts/utilities/hasher');
const exp = require("constants");
const utils = require('../scripts/utils');
const path = require('path');
const snarkjs = require("snarkjs");

const SEED = "mimcsponge";

// async function setupHasher() {
//     return await circomlibjs.buildMimcSponge();
// }

describe('Registry Smart Contract', function () {
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL

    let pedersen;
    let babyjub;
    let F

    let hasher;
    let RegisterVerifierContract;
    let registerVerifier;

    let RegistryContract;
    let registry

    let HasherContract;
    let hasherOnChain;

    let leafToInsert;
    let treeOffChain;

    before(async function () {
        hasher = await setupHasher();
        RegisterVerifierContract = await ethers.getContractFactory("RegisterPlonkVerifier");
        RegistryContract = await ethers.getContractFactory("MerkleRegistry")
        pedersen = await circomlibjs.buildPedersenHash();
        babyjub = await circomlibjs.buildBabyjub();
        F = babyjub.F;

        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        address0 = await signer0.getAddress();

        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const nullifier = 1n;

        const src = [address0, secretBigInt, nullifier]
        leaf = await utils.pedersenHashMultipleInputs(src)

        const hP = babyjub.unpackPoint(leaf);
        hp1 = F.toObject(hP[1])
        leafToInsert = hp1;
    });

    async function fixture() {


        const signers = await ethers.getSigners();
        const signer = signers[0];
        const signer1 = signers[1];

        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        const C = new ethers.ContractFactory(abi, bytecode, signer);

        const hasherContract = await C.deploy();
        const hasherAddress = await hasherContract.getAddress();


        const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherAddress);
        return { signers, signer, signer1, registry, pedersen, babyjub, hasherContract };
    }

    it("Should deploy a hasher on chain", async () => {
        const signers = await ethers.getSigners();
        const signer = signers[0];
        
        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        HasherContract = new ethers.ContractFactory(
            abi,
            bytecode,
            signer
        );

        hasherOnChain = await HasherContract.deploy();

        const contractAddress = await hasherOnChain.getAddress();
        expect(contractAddress).to.be.properAddress;

    });


    it('Should deploy RegisterPlonkVerifier smart contract', async function () {
        registerVerifier = await RegisterVerifierContract.deploy();
        const contractAddress = await registerVerifier.getAddress();

        expect(contractAddress).to.be.properAddress;
    });

    it('Should deploy the Registry smart contract', async function () {
        const hasherOnChainAddress = await hasherOnChain.getAddress();
        const verifierAddress = await registerVerifier.getAddress();
        registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherOnChainAddress, verifierAddress);

        const registryAddress = await registry.getAddress();
        expect(registryAddress).to.be.properAddress;

        const levels = await registry.getLevels();
        expect(levels).to.equal(MERKLE_TREE_LEVEL);
    })

    it("Shold calculate the mimc correctly", async () => {
        const res = await hasherOnChain.MiMCSponge(1, 2, 220);
        const res2 = hasher.hash(1, 2, 220);

        expect(res.xL.toString()).to.equal(hasher.F.toString(res2.xL));
        expect(res.xR.toString()).to.equal(hasher.F.toString(res2.xR));

    });

    it('Should calculate hashLeftRight correctly', async function () {

        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        address0 = await signer0.getAddress();

        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const nullifier = 1n;

        const src = [address0, secretBigInt, nullifier]
        leaf = await utils.pedersenHashMultipleInputs(src)

        const hP = babyjub.unpackPoint(leaf);
        hp1 = F.toObject(hP[1])

        const hashLeftRightValue = hashLeftRight(hasher, hp1, 0);


        const hasherContractaddress = await hasherOnChain.getAddress();

        const zero = BigInt(0).toString(16);
        const zero_256 = '0x' + zero.padStart(64, '0');

        const hp1_hex = '0x'+BigInt(hp1).toString(16);
        const hashLeftRightOnChain = await registry.hashLeftRight(hasherContractaddress, hp1_hex, zero_256);

        expect(hashLeftRightOnChain).to.equal(BigInt(hashLeftRightValue));
    })

    it('Should register a user', async function () {

        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        address0 = await signer0.getAddress();

        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const nullifier = 1n;

        const src = [address0, secretBigInt, nullifier]
        leaf = await utils.pedersenHashMultipleInputs(src)

        const hP = babyjub.unpackPoint(leaf);
        hp1 = F.toObject(hP[1])

        await expect(registry.registerUser(hp1)).to.emit(registry, 'UserRegistered').withArgs(hp1, 0);

    })

    it('Should construct a 3-level Zero Tree', async function () {
        const zero_tree = new merkleTree.MerkleTree(3, [], { hashFunction: (left, right) => hashLeftRight(hasher, left, right) });
        expect(zero_tree.levels).to.equal(3);
        expect(zero_tree.zeros).to.have.lengthOf(4);
        expect(zero_tree.capacity).to.equal(8);

    })

    it('Should construct a one-level Zero Tree', async function () {
        const zero_tree = new merkleTree.MerkleTree(1, [], { hashFunction: (left, right) => hashLeftRight(hasher, left, right) });
        expect(zero_tree.levels).to.equal(1);
        expect(zero_tree.zeros).to.have.lengthOf(2);
        expect(zero_tree.capacity).to.equal(2);
    })

    it('Should insert one element into a one level Merkle Tree (off chain)', async function () {
        // const { signers, signer, signer1, registry, pedersen, babyjub } = await loadFixture(fixture);
        const zero_tree = new merkleTree.MerkleTree(1, [], { hashFunction: (left, right) => hashLeftRight(hasher, left, right) });
        expect(zero_tree.levels).to.equal(1);

        // const zero_tree_hex = zero_tree.zeros.map(zero => BigInt(zero).toString(16)).map(zero => '0x' + zero.padStart(64, '0'));
        expect(zero_tree.zeros).to.have.lengthOf(2);
        expect(zero_tree.capacity).to.equal(2);

        const signers = await ethers.getSigners();
        const hash = pedersen.hash(await signers[0].getAddress());
        const point = babyjub.unpackPoint(hash);
        const point_x = ffjavascript.utils.leBuff2int(point[0]);
        const point_x_hex = BigInt(point_x).toString(16);
        const point_x_hex_256 = '0x' + point_x_hex.padStart(64, '0');
        const leaf = point_x_hex_256;

        zero_tree.insert(leaf);

        expect(zero_tree.root).to.equal(hashLeftRight(hasher, leaf, 0));
    })

    it('Should construct a Merkle Tree off-chain, identical to the one built off-chain', async function () {
        const events = await registry.queryFilter('UserRegistered');
        const sortedEvents = events.sort((a, b) => (a.args.index < b.args.index ? -1 : a.args.index > b.args.index ? 1 : 0));
        const leafs = sortedEvents.map(event => event.args.leaf);

        treeOffChain = new merkleTree.MerkleTree(MERKLE_TREE_LEVEL, leafs, { hashFunction: (left, right) => hashLeftRight(hasher, left, right) });
        // const treeZeros = tree.zeros.map(zero => BigInt(zero).toString(16)).map(zero => '0x' + zero.padStart(64, '0'));
        // console.log("treeZeros: ",treeZeros);
        const registerEvent = events.find(event => event.args.leaf === leafToInsert);
        // console.log("registerEvent.args.leaf: ",registerEvent.args.leaf);

        // const merkleProof = treeOffChain.proof(registerEvent.args.leaf);
        // console.log(merkleProof);

        const root = treeOffChain.proof(leafToInsert).pathRoot;

        const isValidRoot = await registry.isKnownRoot(root);
        expect(isValidRoot).to.be.true;
    })

    it('Should generate a proof for a leaf in the Merkle Tree off chain', async function () {
        wasm = path.join(__dirname, "..", "build", "circuits", "register_js", "register.wasm");
        zkey = path.join(__dirname, "..", "build", "circuits", "register_final.zkey");
        
        const merkleProof = treeOffChain.proof(leafToInsert);
        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        address0 = await signer0.getAddress();

        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const nullifier = 1n;
        const input = {
            "root": merkleProof.pathRoot,
            "nullifierHash": "987654321",
            "recipient": "100",
            "relayer": "50",
            "fee": "10",
            "refund": "5",
            "nullifier": nullifier,
            "secret": secretBigInt,
            "pathElements": merkleProof.pathElements,
            "pathIndices": merkleProof.pathIndices,
            "smartContractWalletAddress": address0
        }

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.plonk.fullProve(input, wasm, zkey);
        const parsedproof = utils.parseProof(proofJson);
        const isValid = await registry.verify(parsedproof, publicInputs);
        // expect(isValid).to.be.true;
    })
})