const { ethers } = require("hardhat");
const { getRegistryAddress } = require("../isDeployed.js");

async function main() {
    const registryAddress = await getRegistryAddress();
    console.log("MerkleRegistry address:", registryAddress);

    const merkleRegistryContract = await ethers.getContractAt("MerkleRegistry", registryAddress);

    const levels = await merkleRegistryContract.getLevels();
    console.log("MerkleRegistry levels:", levels.toString());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });