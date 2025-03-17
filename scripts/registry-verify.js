const { ethers } = require('hardhat');
const { computePedersenHash } = require('../scripts/utils');
const { generateProof, registerUser } = require('./registerUser');
const ACCOUNT_FACTORY_ADDRESS = "0xF74652784Bf245D586544Aa606ee08a764c45cFD"
const SMART_ACCOUNT_ADDRESS = "0x7dD7a828f9264015981FEe39A8bC71ea6eF2D898"
const RUNNER_ADDRESS = process.env.RUNNER_ADDRESS;
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const secret = "hello world"

async function registry_verify() {
    const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

    const MerkleRegistryContract = await ethers.getContractFactory("MerkleRegistry", signer);
    const merkleRegistry = MerkleRegistryContract.attach(process.env.REGISTRY_CONTRACT_ADDRESS)

    const smart_account_address = SMART_ACCOUNT_ADDRESS;
    const secret = "hello world";
    const nullifier = 0n;

    // await registerUser(smart_account_address, secret, nullifier);

    // await registerUser(smart_account_address, secret, nullifier);

    const { pA, pB, pC, pubSignals } = await generateProof(smart_account_address, secret, nullifier);

    const tx = await merkleRegistry.verify(pA, pB, pC, pubSignals);
    await tx.wait();
}

async function main() {

    await registry_verify()
}
main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});