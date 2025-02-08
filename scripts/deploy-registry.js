const { ethers } = require("hardhat")
const { deployHasher } = require("./deploy-hasher")
const { deployRegisterPlonkVerifier } = require("./deploy-register-verifier")

async function main() {
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
    const RegistryContract = await ethers.getContractFactory("MerkleRegistry")

    const hasherAddress = process.env.HASHER_ADDRESS
    const verifierAddress = process.env.REGISTER_PLONK_VERIFIER

    const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherAddress, verifierAddress);
    // const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, "0x5FbDB2315678afecb367f032d93F642f64180aa3");


    console.log("Contract deployed to address:", registry.address)
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});