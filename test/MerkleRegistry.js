const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const assert = require('assert');
const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");
const merkleTree = require('fixed-merkle-tree');
const { setupHasher, hashLeftRight } = require('../scripts/utilities/hasher');
const exp = require("constants");

const SEED = "mimcsponge";

// async function setupHasher() {
//     return await circomlibjs.buildMimcSponge();
// }

describe('Registry Smart Contract', function () {
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL

    let pedersen;
    let babyjub;

    let hasher;
    let RegisterVerifierContract;
    let registerVerifier;

    let RegistryContract;
    let registry

    let HasherContract;
    let hasherOnChain;

    before(async function () {
        hasher = await setupHasher();
        RegisterVerifierContract = await ethers.getContractFactory("RegisterPlonkVerifier");
        RegistryContract = await ethers.getContractFactory("MerkleRegistry")
        pedersen = await circomlibjs.buildPedersenHash();
        babyjub = await circomlibjs.buildBabyjub();
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
        registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherOnChainAddress);
        
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
        // const { signers, signer, signer1, registry, pedersen, babyjub, hasherContract } = await loadFixture(fixture);
        const signers = await ethers.getSigners();
        const signer = signers[0];
        const hash = pedersen.hash(await signer.getAddress());
        const point = babyjub.unpackPoint(hash);
        const point_x = ffjavascript.utils.leBuff2int(point[0]);
        const point_x_hex = '0x' + BigInt(point_x).toString(16);
        const leaf = point_x_hex;
        const hashLeftRightValue = hashLeftRight(hasher, leaf, 0);

        const hashLeftRightValueHex = BigInt(hashLeftRightValue).toString(16);
        const hashLeftRightValueHex256 = '0x' + hashLeftRightValueHex.padStart(64, '0');

        const hasherContractaddress = await hasherOnChain.getAddress();

        const zero = BigInt(0).toString(16);
        const zero_256 = '0x' + zero.padStart(64, '0');

        const hashLeftRightOnChain = await registry.hashLeftRight(hasherContractaddress, leaf, zero_256);

        expect(hashLeftRightOnChain).to.equal(hashLeftRightValueHex256);
    })

    it('Should register a user', async function () {
        const signers = await ethers.getSigners();
        const signer = signers[0];

        const hash = pedersen.hash(await signer.getAddress());
        const point = babyjub.unpackPoint(hash);
        const point_x = ffjavascript.utils.leBuff2int(point[0]);
        const point_x_hex = '0x' + BigInt(point_x).toString(16);
        const leaf = point_x_hex;
        await expect(registry.registerUser(leaf)).to.emit(registry, 'UserRegistered').withArgs(leaf, 0);

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

    it('Should insert one element into a one level Merkle Tree', async function () {
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

    it('Should construct a one level Merkle Tree', async function () {
        let point, point_x, point_x_hex, leaf;

        // const { signers, signer, signer1, registry, pedersen, babyjub } = await loadFixture(fixture);

        const signers = await ethers.getSigners();

        const last_root = await registry.getLastRoot();

        const events = await registry.queryFilter('UserRegistered');

        const sortedEvents = events.sort((a, b) => (a.args.index < b.args.index ? -1 : a.args.index > b.args.index ? 1 : 0));

        const leafs = sortedEvents.map(event => event.args.leaf);

        const tree = new merkleTree.MerkleTree(MERKLE_TREE_LEVEL, leafs, { hashFunction: (left, right) => hashLeftRight(hasher, left, right) });

        const hash = pedersen.hash(await signers[0].getAddress());
        point = babyjub.unpackPoint(hash);
        point_x = ffjavascript.utils.leBuff2int(point[0]);
        hex_string = BigInt(point_x).toString(16);
        point_x_hex = '0x' + hex_string.padStart(64, '0');
        user_0 = point_x_hex;

        const registerEvent = events.find(event => event.args.leaf === user_0);

        const merkleProof = tree.proof(user_0);
        console.log(merkleProof);

        const root = tree.proof(user_0).pathRoot;
        hex_root = BigInt(root).toString(16);
        hex_root_256 = '0x' + hex_root.padStart(64, '0');
        console.log(hex_root_256);

        const isValidRoot = await registry.isKnownRoot(hex_root_256);
        expect(isValidRoot).to.be.true;
    })
})