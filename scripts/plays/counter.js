const { ethers } = require("hardhat");



async function main() {
    const counterAddress = "0x59d0d591b90ac342752ea7872d52cdc3c573ab71"
    const counterContract = await ethers.getContractAt("Counter", counterAddress);

    const tx = await counterContract.getCount();
    console.log("Counter value:", tx.toString());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });