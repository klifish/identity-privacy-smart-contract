
const { ethers } = require('hardhat');
const { computePedersenHash } = require('../scripts/utils');
const { generateProof, registerUser } = require('./registerUser');
const { getRandomRunnerAddress, getFirstRunnerAddress, getAccountFactoryAddress } = require('./isDeployed');

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const secret = "hello world"

async function createSmartAccount() {
    const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

    console.log("Creating smart account");

    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory", signer);
    const myAccountFactory = MyAccountFactoryContract.attach(await getAccountFactoryAddress());

    const commitment = await computePedersenHash(secret);
    const salt = 1

    // Here, I am not sure why the following two calls of getAddress() return same address
    // is it because getAddress() is conflicting with the function in the contract? here the reuslt is the address of account factory
    // const accountAddress = await myAccountFactory.getAddress(commitment, salt);
    // console.log("Account address:", accountAddress);

    // const accountAddress1 = await myAccountFactory.getAddress("111", salt + 1);
    // console.log("Account address:", accountAddress1);

    const tx = await myAccountFactory.createAccount(commitment, salt);
    await tx.wait();

    const filter = myAccountFactory.filters.AccountCreated();
    const events = await myAccountFactory.queryFilter(filter);

    latestEvent = events[events.length - 1];
    console.log("MyAccount address:", latestEvent.args.accountAddress);
    return latestEvent.args.accountAddress;
}



async function sendUserOperation() {
    const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

    const RunnerContract = await ethers.getContractFactory("Runner", signer);
    const runnerAddress = await getFirstRunnerAddress();
    console.log("Runner address:", runnerAddress);
    const runner = RunnerContract.attach(runnerAddress);

    let userOperation = {
        sender: runnerAddress, // Address of the sender (e.g., smart contract wallet)
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

    // const smart_account_address = await createSmartAccount();
    const smart_account_address = "0xECc88Cc6a3c93AD477C6b72A486C14653803D044"
    const secret = "hello world";
    const nullifier = 0n;
    // await registerUser(smart_account_address, secret, nullifier);

    console.log("Generating proof");
    const proof = await generateProof(smart_account_address, secret, nullifier);
    console.log("Proof generated");

    // console.log("Verifying proof on chain");
    // const verificationResult = await runner.verifyProof(proof, { gasLimit: 1000000 });
    // console.log("Verification result:", verificationResult);

    userOperation.signature = proof;
    // console.log("userOperation.signature:", userOperation.signature);

    // deploy a new contract
    const bytecode = (await ethers.getContractFactory("HelloWorld")).bytecode;
    // console.log("Bytecode:", bytecode);

    userOperation.callData = bytecode;

    const options = {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'alchemy_requestGasAndPaymasterAndData',
            params: [
                {
                    policyId: '32871eca-3b5c-4fe8-a71b-eebd1e569fb7',
                    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
                    dummySignature: '0xe8fe34b166b64d118dccf44c7198648127bf8a76a48a042862321af6058026d276ca6abb4ed4b60ea265d1e57e33840d7466de75e13f072bbd3b7e64387eebfe1b',
                    userOperation: {
                        sender: userOperation.sender,
                        nonce: '0x0',
                        initCode: '0x',
                        callData: userOperation.callData
                    }
                }
            ]
        })
    };

    console.log("Sending request to Alchemy API...");
    await fetch('https://polygon-amoy.g.alchemy.com/v2/VG6iwUaOlQPYcDCb3AlkyAxrAXF7UzU9', options)
        .then(res => res.json())
        .then(res => console.log("Alchemy Response:", res))
        .catch(err => {
            console.error("Alchemy API Error:", err);
        });

    // const options = {
    //     method: 'POST',
    //     headers: { accept: 'application/json', 'content-type': 'application/json' },
    //     body: JSON.stringify({
    //         id: 1,
    //         jsonrpc: '2.0',
    //         method: 'eth_sendUserOperation',
    //         params: [userOperation]
    //     })
    // };

    // fetch(API_URL, options)
    //     .then(res => res.json())
    //     .then(res => console.log(res))
    //     .catch(err => console.error(err));

}

const PROOF = "0x0c18ce0a9a007d3b7f3bb31f282278d53e172f0b036c4be3743515176117efd42098d61be467dbb51e7cc960ab8a80f280cb790205dc623022dfe54657097729040f88b43abe143d339a22ebbc681cd4b2c75ab4070a2ab375630b7cbc99fbcd3030047032e8e44985fcd327d9f7a3b75eb654f11c73128833b42f99da4f3bf11a5670423292abd350c997f193073516a50ea5c750e0a5367aa9bedee7328c611c1e1c70a342e9a05ca1152488d1ee4be30d045c3089adde3897477483885f292a44a4e974d90dfad940b02afccba410c5deaf33e4dbfa9ec6b906357825933705d0609adfa18a7ea728a162cd5acebed1e1d0658b41eaf7209350468d555e251191f8b446226ae7fdc9a1fa89655591430bd8b96bd1f7f73f8161351a232c58000000000000000000000000000000000000000000000000000000003ade68b1"

async function runnerVerify() {
    const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

    const RunnerContract = await ethers.getContractFactory("Runner", signer);
    const runnerAddress = await getFirstRunnerAddress();
    console.log("Runner address:", runnerAddress);
    const runner = RunnerContract.attach(runnerAddress);

    const entryPoint = await runner.entryPoint();
    console.log("Entry point:", entryPoint);

    console.log("Verifying proof on chain");
    // const gasLimit = ethers.utils.hexlify(1000000);
    const verificationResult = await runner.verifyProof(PROOF, { gasLimit: 1000000 });
    verificationResult.wait();

    const decodedProof = await runner._deserializeProofAndPublicSignals(PROOF);
    console.log("Decoded proof:", decodedProof);


}
// _createSmartAccount();
async function main() {
    // await runnerVerify();
    await sendUserOperation();
    // await createSmartAccount();
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
// _sendOperation();