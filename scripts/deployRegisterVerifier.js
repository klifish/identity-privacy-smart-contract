const { ethers } = require("hardhat")
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
// provider - Alchemy
const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

async function deployRegisterVerifier() {
    const RegisterGroth16VerifierContract = await ethers.getContractFactory("RegisterGroth16Verifier", signer);
    const registerGroth16Verifier = await RegisterGroth16VerifierContract.deploy();

    const address = await registerGroth16Verifier.getAddress();

    return address;
}

module.exports = { deployRegisterVerifier }

// main().then(() => process.exit(0)).catch(error => {
//     console.error(error);
//     process.exit(1);
// });