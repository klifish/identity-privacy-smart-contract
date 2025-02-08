
const { ethers } = require('hardhat');
const { computePedersenHash } = require('../scripts/utils');
const { generateProof, registerUser } = require('./registerUser');
const ACCOUNT_FACTORY_ADDRESS = "0xF74652784Bf245D586544Aa606ee08a764c45cFD"
const SMART_ACCOUNT_ADDRESS = "0x7dD7a828f9264015981FEe39A8bC71ea6eF2D898"
const RUNNER_ADDRESS = process.env.RUNNER_ADDRESS;
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const secret = "hello world"

async function _createSmartAccount() {

    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory");
    const myAccountFactory = MyAccountFactoryContract.attach(ACCOUNT_FACTORY_ADDRESS);


    const commitment = await computePedersenHash(secret);
    const salt = 1

    const accountAddress = await myAccountFactory.getAddress(commitment, salt);
    console.log("Account address:", accountAddress);

    const accountAddress1 = await myAccountFactory.getAddress("111", salt + 1);
    console.log("Account address:", accountAddress1);

    const tx = await myAccountFactory.createAccount(commitment, salt);
    await tx.wait();

    const filter = myAccountFactory.filters.AccountCreated();
    const events = await myAccountFactory.queryFilter(filter);
    // console.log("MyAccount address:", events);
}



async function _sendOperation() {
    const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

    const RunnerContract = await ethers.getContractFactory("Runner", signer);
    const runner = RunnerContract.attach(RUNNER_ADDRESS);

    const verificationResult = await runner.verifyProof("0x1ef62113c90d6e2bd093cf918ca8e9337634261109e7387ca7038451e8aee40d11590169ab561db8f30fc4a7c818d4e3c3ce1b9137f058dc08197e9a4d7beb541f5fd014fd7fa9f1bc606b6bced1fe6b37ca55b2f1e96ce6070466cbdbfd619e128ebb8990058a213e5bb5021d6fa6d55a3b8b5663c2773ab67226bfa702bb2c1b1e97346269c09b0a05a29dfa2ba4228794ce53c8a71ee48e289fecbfca61f616fa137d378c4588175ff35c9e1e55e98fe1dabd398fb0adb3c88afb89d1d01d27255bdde741a0a3b37f5591905106f84519741f2c999d896b02a5bc08cb4e65028ffca078f6c49808d0e93ea33000cc984b68ed94dbf488e610c356d9e5dbd31ae3f3f38b01ad955f8f41b65818e47886fb1ede003140ea7bb8b7afe2e5fc47069b5bf0efab67177e223394b11aeb713c2d01939a1dbe55c524c6d0839495f412299f90310c86de9c61eeb79b7cdb2c7fbdb257be8c6d2475e43984583f829f27c3db1dc1f6cf7eb928376543e6b2b29f1f4d96199b082625c9ced73888f1ef1eeb66537f9ab0a07df1bc4bb8775d8306872fdc354bf01517fa81b71fe9d49521f1c8f4c03ec7b9159f91324ccdfe016535ad36ecf8280622d7539ca6acc0ac1fc5e3809fed7f2d5005b20e12523e8faeba8020319c0f04b1fb28c40223a05e140f7ce31799f70fcd831c864fb6003b673f4224125cc1c51610531e73cb07bb2bbcfa5653bbf184d6a9cc3662b486cc801a8392e02fdba213ea0425851d41271f750bef083678f75e733397b7bb5f2cf512a6ced398bdba0a7129a77b2cd9e0143a84992808e93218fd4c82795272de62210d0abf50d782eae30b12c8bfa52416408b633861d49e57aaf235674be05211cf4e3f89b9bfd63465c85fe650d32b2c2f88735d396a49634050f14b2c4e9a52d3ce8e50d2a59be15aaad99697f21d0fb200da98b4844ab3afa28746806fd3f10b7aff4ecd5429b8a9b43c17bd8c05179b3ea348bd81dfea0390248712ac8dc4bff814ffd43500572964d7a40df89a1f772b00116074d4fe9af177595202fee993a9347b20eb3904b1f8624212b60701ed3c4756dee492be032975322b1aa924cd0970c07ef5fbbc8a212cd4a63366000000000000000000000000000000000000000000000000000000003ade68b1", { gasLimit: 1500000 });
    verificationResult.wait();
    const receipt = await alchemyProvider.getTransactionReceipt(verificationResult.hash);
    console.log("Verification result:", receipt);

    // tx.wait();
    // console.log("Transaction:", tx);

    // const code = await alchemyProvider.getCode(RUNNER_ADDRESS);
    // console.log("Code:", code);

    // return;

    return;
    let userOperation = {
        sender: RUNNER_ADDRESS, // Address of the sender (e.g., smart contract wallet)
        nonce: "0x0", // Replace with actual nonce
        initCode: "0x", // Initialization code, if needed
        callData: "0x", // Encoded function call data
        callGasLimit: "0x5208", // Gas limit for the operation
        verificationGasLimit: "0x5208", // Verification gas limit
        preVerificationGas: "0x0", // Gas cost for pre-verification
        maxFeePerGas: "0x09184e72a000", // Max fee per gas
        maxPriorityFeePerGas: "0x09184e72a000", // Max priority fee
        paymasterAndData: "0x", // Paymaster details, if applicable
        signature: "0x" // Replace with the correct signature
    };

    const smart_account_address = SMART_ACCOUNT_ADDRESS;
    const secret = "hello world";
    const nullifier = 0n;

    // await registerUser(smart_account_address, secret, nullifier);

    const proof = await generateProof(smart_account_address, secret, nullifier);
    console.log("Proof:", proof);
    userOperation.signature = proof;

    // deploy a new contract
    const bytecode = (await ethers.getContractFactory("HelloWorld")).bytecode;
    console.log("Bytecode:", bytecode);

    userOperation.callData = bytecode;

    const options = {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_sendUserOperation',
            params: [userOperation]
        })
    };

    fetch(API_URL, options)
        .then(res => res.json())
        .then(res => console.log(res))
        .catch(err => console.error(err));

}

// _createSmartAccount();
async function main() {
    await _sendOperation();
    // _createSmartAccount();
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
// _sendOperation();