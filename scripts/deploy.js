const { ethers } = require("hardhat");
const { deployHasher } = require("./deployHasher.js");
const { deployRegisterVerifier } = require("./deployRegisterVerifier.js");
const { deployRegistry } = require("./deployRegistry.js");

async function main() {

    // 0xb52EB40826970b9C2903715E670E18504a06B3ab
    // await deployHasher(); // No need to deploy the hasher contract again

    // 0x85e75fbeb7E6F8E5d1bD22713E0F4243fD6c5165
    // await deployRegisterVerifier(); // No need to deploy the register verifier contract again

    //0x768D5a08Df26420c9AB3686807Faf9571c605D15
    // await deployRegistry(); // No need to deploy the registry contract again
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});