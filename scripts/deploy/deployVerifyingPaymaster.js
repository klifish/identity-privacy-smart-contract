const { ethers } = require("hardhat");
const { getVerifyingPaymsaterFactoryAddress } = require("./isDeployed.js");

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ENTRY_POINT = process.env.ENTRY_POINT;

// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployVerifyingPaymasterFactory() {

    const VerifyingPaymasterFactoryContract = await ethers.getContractFactory("VerifyingPaymasterFactory", signer);
    const verifyingPaymasterFactory = await VerifyingPaymasterFactoryContract.deploy()

    const tx = verifyingPaymasterFactory.deploymentTransaction(); // Get transaction details
    // console.log("Transaction Hash:", tx.hash);

    const receipt = await tx.wait(); // Wait for the transaction to be mined
    // console.log("Transaction Receipt:", receipt);

    const address = await verifyingPaymasterFactory.getAddress()
    return address
}

async function deployVerifyingPaymaster() {
    const verifyingPaymasterFactoryAddress = await getVerifyingPaymsaterFactoryAddress();
    const verifyingPaymasterFactory = await ethers.getContractAt("VerifyingPaymasterFactory", verifyingPaymasterFactoryAddress, signer);
    const tx = await verifyingPaymasterFactory.deployVerifyingPaymaster(ENTRY_POINT, signer.address);
    await tx.wait();

    const filter = verifyingPaymasterFactory.filters.VerifyingPaymasterDeployed();
    const events = await verifyingPaymasterFactory.queryFilter(filter);
    const verifyingPaymasterAddress = events[events.length - 1].args.verifyingPaymasterAddress;
    return verifyingPaymasterAddress;

}

async function deployVerifyingPaymasterWithoutFactory() {
    const VerifyingPaymasterContract = await ethers.getContractFactory("VerifyingPaymaster", signer);
    const verifyingPaymaster = await VerifyingPaymasterContract.deploy(ENTRY_POINT, signer.address);

    const tx = verifyingPaymaster.deploymentTransaction(); // Get transaction details
    console.log("Transaction Hash:", tx.hash);

    const receipt = await tx.wait(); // Wait for the transaction to be mined
    console.log("Transaction Receipt:", receipt);

    // return verifyingPaymaster.address;
    const address = await verifyingPaymaster.getAddress()
    return address
}

module.exports = { deployVerifyingPaymasterFactory, deployVerifyingPaymaster, deployVerifyingPaymasterWithoutFactory }