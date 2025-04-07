const { ethers } = require("hardhat");

async function main() {
    const userDataAddress = "0x141ea3F12cDbaF9Eb724c19A402abB95CEfdd8B3"

    const userDataContract = await ethers.getContractAt("UserData", userDataAddress);

    const tx = await userDataContract.read();
    console.log("Transaction: ", tx);
    // const receipt = await tx.wait();
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });