const {ethers} = require("hardhat")

async function main(){
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
    const RegistryContract = await ethers.getContractFactory("MerkleRegistry")

    const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, "0xEA2F5117A7379F0844F7A500a550757755b84FB4");
    // const registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, "0x5FbDB2315678afecb367f032d93F642f64180aa3");


    console.log("Contract deployed to address:", registry.address)
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});