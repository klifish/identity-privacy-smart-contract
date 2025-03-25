const { ethers } = require("hardhat")
const { getCommitmentVerifierAddress } = require("./isDeployed.js")

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployAccountFactory() {
    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory", signer);
    const accountFactory = await MyAccountFactoryContract.deploy(process.env.ENTRY_POINT, await getCommitmentVerifierAddress(), 0)

    const address = await accountFactory.getAddress()
    return address
}

module.exports = { deployAccountFactory }