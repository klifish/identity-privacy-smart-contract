const { ethers } = require("hardhat");
const API_URL = process.env.API_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const alchemyProvider = new ethers.JsonRpcProvider(API_URL)
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider)

async function deployCommitmentVerifier() {
    const CommitmentGroth16VerifierContract = await ethers.getContractFactory("CommitmentGroth16Verifier", signer);
    const commitmentGroth16Verifier = await CommitmentGroth16VerifierContract.deploy();

    const address = await commitmentGroth16Verifier.getAddress();

    return address;
}

module.exports = { deployCommitmentVerifier }