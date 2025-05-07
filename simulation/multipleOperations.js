const { deployUserDataWithSmartAccountSingle, updateUserDataWithSmartAccount } = require("./userDataDeployer")
const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
    const walletsFilePath = "./simulation/wallets.json";
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath, "utf8"));

    for (let wallet of wallets) {
        const userDataAddress = await deployUserDataWithSmartAccountSingle(wallet.secret, wallet.smartAccountAddress);
        console.log("User data contract deployed at address:", userDataAddress);

        const userDataContract = await ethers.getContractAt("UserData", userDataAddress);
        const userData = await userDataContract.read();
        console.log("User data:", userData);

        await updateUserDataWithSmartAccount(wallet.secret, wallet.smartAccountAddress, userDataAddress);
        console.log("User data updated with smart account:", wallet.smartAccountAddress);

        const updatedUserData = await userDataContract.read();
        console.log("Updated user data:", updatedUserData);

        break;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//