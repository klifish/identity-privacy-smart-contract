const { ethers } = require("hardhat");

async function main() {
    const userDataAddress = "0x637a2232D9664fE31D4aC4DC259168A00E578685"

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