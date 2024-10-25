const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const assert = require('assert');
const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");
const crypto = require('crypto')

const registry_contract = require("../artifacts/contracts/MerkleRegistry.sol/MerkleRegistry.json");
const { toHex } = require("thirdweb");
const exp = require("constants");

const SEED = "mimcsponge";

function buff2hex(buff) {
    function i2hex(i) {
      return ('0' + i.toString(16)).slice(-2);
    }
    return Array.from(buff).map(i2hex).join('');
}

const toFixedHex = (number, length = 32) =>
    '0x' +
    BigInt(number)
      .toString(16)
      .padStart(length * 2, '0')

const rbigint = nbytes => ffjavascript.utils.leBuff2int(crypto.randomBytes(nbytes))

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
        const registryAddress = await registry.getAddress();

        // const signers = await ethers.getSigners();
        // const signer = signers[0];
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