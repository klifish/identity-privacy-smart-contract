const { ethers } = require("hardhat");
const { deployHasher } = require("./deployHasher.js");
const { deployRegisterVerifier } = require("./deployRegisterVerifier.js");
const { deployRegistry } = require("./deployRegistry.js");
const { deployRunnerFactory } = require("./deployRunnerFactory.js");
const { isDeployed, setDeployed, getDeployed } = require("./isDeployed.js");

async function deploy() {


    // 0xb52EB40826970b9C2903715E670E18504a06B3ab
    if (!isDeployed("Hasher")) {
        const hasherAddress = await deployHasher();
        setDeployed("Hasher", hasherAddress);
    }
    console.log("Hasher contract already deployed at address:", await getDeployed("Hasher"));

    // 0x85e75fbeb7E6F8E5d1bD22713E0F4243fD6c5165
    if (!isDeployed("RegisterVerifier")) {
        const registerVerifierAddress = await deployRegisterVerifier();
        setDeployed("RegisterVerifier", registerVerifierAddress);
    }
    console.log("RegisterVerifier contract already deployed at address:", await getDeployed("RegisterVerifier"));



    //0x768D5a08Df26420c9AB3686807Faf9571c605D15
    if (!isDeployed("Registry")) {
        const registryAddress = await deployRegistry();
        setDeployed("Registry", registryAddress);
    }
    console.log("Registry contract already deployed at address:", await getDeployed("Registry"));

    // 0x4C40Caf1A25a7b281fA2fcb71cC0637896fcf891
    if (!isDeployed("RunnerFactory")) {
        const runnerFactoryAddress = await deployRunnerFactory();
        setDeployed("RunnerFactory", runnerFactoryAddress);
    }
    console.log("RunnerFactory contract already deployed at address:", await getDeployed("RunnerFactory"));
    // await deployRunnerFactory();
}

async function main() {
    await deploy();
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});