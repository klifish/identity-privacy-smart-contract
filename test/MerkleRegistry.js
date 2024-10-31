const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const assert = require('assert');
const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");
const crypto = require('crypto')

const { toHex } = require("thirdweb");

const SEED = "mimcsponge";

describe('Registry Smart Contract', function () {
    async function fixture(){
        pedersen = await circomlibjs.buildPedersenHash();
        
        babyjub = await circomlibjs.buildBabyjub();

        const signers = await ethers.getSigners();
        const signer = signers[0];
        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        const C = new ethers.ContractFactory(abi, bytecode, signer);

        const hasher = await C.deploy();
        const hasherAddress = await hasher.getAddress();

        const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
        const RegistryContract = await ethers.getContractFactory("MerkleRegistry")    
        const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherAddress);
        return {signer, registry, pedersen, babyjub};
    }

    it('Should deploy the Registry smart contract', async function(){
        const {registry} = await loadFixture(fixture);
        const levels = await registry.getLevels();
        assert.equal(levels, process.env.MERKLE_TREE_LEVEL);
    })

    it('Should register a user', async function(){
        const {signer,registry, pedersen, babyjub} = await loadFixture(fixture);

        
        const hash = pedersen.hash(await signer.getAddress());

        const leaf = toHex(babyjub.unpackPoint(hash)[0]);
        
        await expect(registry.registerUser(leaf)).to.emit(registry, 'UserRegistered').withArgs(leaf, 0);
        
    })
})