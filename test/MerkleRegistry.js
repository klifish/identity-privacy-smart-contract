const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const assert = require('assert');
const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");
const merkleTree = require('fixed-merkle-tree');
const { hash } = require("crypto");

const SEED = "mimcsponge";

async function setupHasher() {
    return await circomlibjs.buildMimcSponge();
}

describe('Registry Smart Contract', function () {
    let hasher;
    const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")
    before(async function () {
        hasher = await setupHasher();
    });

    const hashLeftRight = (left, right) => {
        // Convert left and right to BigInt if they are not already
        const leftValue = BigInt(left);
        const rightValue = BigInt(right);

        // Ensure values are within the FIELD_SIZE
        if (leftValue >= FIELD_SIZE) throw new Error("_left should be inside the field");
        if (rightValue >= FIELD_SIZE) throw new Error("_right should be inside the field");

        let xL = leftValue;
        let xR = BigInt(0);

        ({ xL, xR } = hasher.hash(xL, xR, 220));
        xL_str = hasher.F.toString(xL);
        xR_str = hasher.F.toString(xR);
        xL_bigint = ffjavascript.utils.unstringifyBigInts(xL_str);
        // console.log('xL_bigint ', xL_bigint);
        xR_bigint = ffjavascript.utils.unstringifyBigInts(xR_str);

        // console.log('hasher.F.toString(res2.xL) ', hasher.F.toString(xL));
        xL = xL_bigint;
        // console.log('xL ', xL);
        
        xR = xR_bigint;
        // hasher.F.toString(res2.xL)
        
        xR = (xR + rightValue) % FIELD_SIZE;
        ({ xL, xR } = hasher.hash(xL, xR, 220));
        xL_str = hasher.F.toString(xL);
        xR_str = hasher.F.toString(xR);

        xL_bigint = ffjavascript.utils.unstringifyBigInts(xL_str);
        xR_bigint = ffjavascript.utils.unstringifyBigInts(xR_str);

        return xL_bigint;
    };

    async function fixture() {
        pedersen = await circomlibjs.buildPedersenHash();

        babyjub = await circomlibjs.buildBabyjub();

        const signers = await ethers.getSigners();
        const signer = signers[0];
        const signer1 = signers[1];

        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        const C = new ethers.ContractFactory(abi, bytecode, signer);

        const hasherContract = await C.deploy();
        const hasherAddress = await hasherContract.getAddress();

        const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
        const RegistryContract = await ethers.getContractFactory("MerkleRegistry")
        const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherAddress);
        return { signers, signer, signer1, registry, pedersen, babyjub, hasherContract };
    }

    it("Shold calculate the mimc correctly", async () => {
        const { signers, signer, signer1, registry, pedersen, babyjub,  hasherContract} = await loadFixture(fixture);

        const res = await hasherContract.MiMCSponge(1,2, 220);

        // console.log("Cir: " + bigInt(res.toString(16)).toString(16));

        const res2 = hasher.hash(1,2, 220);
        // console.log("Ref: " + bigInt(res2).toString(16));
        expect(res.xL.toString()).to.equal(hasher.F.toString(res2.xL));
        expect(res.xR.toString()).to.equal(hasher.F.toString(res2.xR));

    });

    it('Should deploy the Registry smart contract', async function () {
        const { registry } = await loadFixture(fixture);
        const levels = await registry.getLevels();
        assert.equal(levels, process.env.MERKLE_TREE_LEVEL);
    })

    it('Should calculate hashLeftRight correctly', async function () {
        const { signers, signer, signer1, registry, pedersen, babyjub, hasherContract } = await loadFixture(fixture);
        const hash = pedersen.hash(await signer.getAddress());
        const point = babyjub.unpackPoint(hash);
        const point_x = ffjavascript.utils.leBuff2int(point[0]);
        const point_x_hex = '0x' + BigInt(point_x).toString(16);
        const leaf = point_x_hex;
        const hashLeftRightValue = hashLeftRight(leaf, 0);

        const hashLeftRightValueHex = BigInt(hashLeftRightValue).toString(16);
        const hashLeftRightValueHex256 = '0x' + hashLeftRightValueHex.padStart(64, '0');
        console.log("HashLeftRight: \n", hashLeftRightValueHex256);

        const hasherContractaddress = await hasherContract.getAddress();
        const zero = BigInt(0).toString(16);
        const zero_256 = '0x' + zero.padStart(64, '0');

        const hashLeftRightOnChain = await registry.hashLeftRight(hasherContractaddress,leaf, zero_256);
        console.log("HashLeftRight on chain: \n", hashLeftRightOnChain);
    })



    

    // it('Should register a user', async function () {
    //     const { signer, registry, pedersen, babyjub } = await loadFixture(fixture);
    //     const hash = pedersen.hash(await signer.getAddress());
    //     const point = babyjub.unpackPoint(hash);
    //     const point_x = ffjavascript.utils.leBuff2int(point[0]);
    //     const point_x_hex = '0x' + BigInt(point_x).toString(16);
    //     const leaf = point_x_hex;
    //     await expect(registry.registerUser(leaf)).to.emit(registry, 'UserRegistered').withArgs(leaf, 0);

    // })
    // it('Should constract a 3-level Zero Tree', async function () {
    //     const zero_tree = new merkleTree.MerkleTree(3, [], { hashFunction: hashLeftRight });
    //     expect(zero_tree.levels).to.equal(3);
    //     expect(zero_tree.zeros).to.have.lengthOf(4);

    //     // const zero_tree_hex = zero_tree.zeros.map(zero => BigInt(zero).toString(16)).map(zero => '0x' + zero.padStart(64, '0'));
    // })

    // it('Should constract a one-level Zero Tree', async function () {
    //     const zero_tree = new merkleTree.MerkleTree(1, [], { hashFunction: hashLeftRight });
    //     expect(zero_tree.levels).to.equal(1);
    //     expect(zero_tree.zeros).to.have.lengthOf(2);
    //     expect(zero_tree.capacity).to.equal(2);
    // })

    // it('Should insert one item into a one level MT', async function () {
    //     const { signers, signer, signer1, registry, pedersen, babyjub } = await loadFixture(fixture);
    //     const zero_tree = new merkleTree.MerkleTree(1, [], { hashFunction: hashLeftRight });
    //     expect(zero_tree.levels).to.equal(1);
    //     const zero_tree_hex = zero_tree.zeros.map(zero => BigInt(zero).toString(16)).map(zero => '0x' + zero.padStart(64, '0'));
    //     expect(zero_tree.zeros).to.have.lengthOf(2);
        
    //     expect(zero_tree.capacity).to.equal(2);

    //     const hash = pedersen.hash(await signers[0].getAddress());
    //     const point = babyjub.unpackPoint(hash);
    //     const point_x = ffjavascript.utils.leBuff2int(point[0]);
    //     // const point_x_hex = '0x' + BigInt(point_x).toString(16);
    //     const point_x_hex = BigInt(point_x).toString(16);
    //     const point_x_hex_256 = '0x' + point_x_hex.padStart(64, '0');
        
    //     const leaf = point_x_hex_256;
    //     zero_tree.insert(leaf);

    //     // console.log("Root: ", zero_tree.root);
    //     expect(zero_tree.root).to.equal(hashLeftRight(leaf,0));
        
    // })

    it('Should construct a one level Merkle Tree', async function () {
        let point, point_x, point_x_hex, leaf;

        const { signers, signer, signer1, registry, pedersen, babyjub } = await loadFixture(fixture);

        const NUM =1;

        for (let i = 0; i < NUM; i++) {
            const hash = pedersen.hash(await signers[i].getAddress());
            point = babyjub.unpackPoint(hash);
            point_x = ffjavascript.utils.leBuff2int(point[0]);
            hex_string = BigInt(point_x).toString(16);
            point_x_hex = '0x' + hex_string.padStart(64, '0');
            leaf = point_x_hex;
            // console.log("Leaf: ", leaf);
            await registry.registerUser(leaf);
        }

        const last_root = await registry.getLastRoot();

        const events = await registry.queryFilter('UserRegistered');

        const sortedEvents = events.sort((a, b) => (a.args.index < b.args.index ? -1 : a.args.index > b.args.index ? 1 : 0));

        const leafs = sortedEvents.map(event => event.args.leaf);

        const MERKLE_TREE_LEVEL = 1;

        // const zero_tree = new merkleTree.MerkleTree(3, [], { hashFunction: hashLeftRight });
        // const hex_zeros = zero_tree.zeros.map(zero => BigInt(zero).toString(16)).map(zero => '0x' + zero.padStart(64, '0'));
        // console.log("Zero tree: ",hex_zeros);

        // console.log("Leafs: ", leafs);
        const tree = new merkleTree.MerkleTree(MERKLE_TREE_LEVEL, leafs, { hashFunction: hashLeftRight });

        const root_1 = tree.root;
        // console.log("Root: ", root_1);
        const hex_root_1 = BigInt(root_1).toString(16);
        const root_1_256 = '0x' + hex_root_1.padStart(64, '0');
        // console.log("Root on chain: ", root_1_256);

        const hash = pedersen.hash(await signers[0].getAddress());
        point = babyjub.unpackPoint(hash);
        point_x = ffjavascript.utils.leBuff2int(point[0]);
        hex_string = BigInt(point_x).toString(16);
        point_x_hex = '0x' + hex_string.padStart(64, '0');
        user_0 = point_x_hex;

        // console.log("User 0: ", user_0);

        const registerEvent = events.find(event => event.args.leaf === user_0);
        const index = registerEvent.args.index;
        const root = tree.proof(user_0).pathRoot;
        hex_root = BigInt(root).toString(16);
        hex_root_256 = '0x' + hex_root.padStart(64, '0');
        // console.log("Root off chain: ", hex_root_256);

        const isValidRoot = await registry.isKnownRoot(hex_root_256);
        console.log(isValidRoot);
    })
})