const {ethers} = require("hardhat")

async function main(){
    const RegisterPlonkVerifierContract = await ethers.getContractFactory("PlonkVerifier");
    const registerPlonkVerifier = await RegisterPlonkVerifierContract.deploy();
    // registerPlonkVerifier.waitForDeployment();
    console.log("Contract deployed to address:", registerPlonkVerifier.target)   
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});