
const { ethers } = require('hardhat');
const { computePedersenHash } = require('../scripts/utils');
const { generateProof, registerUser } = require('./registerUser');
const { getVerifyingPaymsaterAddress, getFirstRunnerAddress, getAccountFactoryAddress } = require('./isDeployed');
const { depositToRunner, withdrawAllFromRunner } = require('./runnerInteraction');
const { fillAndSign, packUserOp, fillAndPcak, simulateValidation, fillUserOp } = require('../scripts/userOp');
const fs = require("fs");

const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;
const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT;

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const secret = "hello world"
const MOCK_VALID_UNTIL = '0x00000000deadbeef'
const MOCK_VALID_AFTER = '0x0000000000001234'

const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);


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

    const runnerAddress = await getFirstRunnerAddress();
    const runner = await ethers.getContractAt("Runner", runnerAddress);
    console.log("Runner address:", runnerAddress);

    let userOperation = {
        sender: runnerAddress,
        callData: "0xb61d27f600000000000000000000000043f6bfbe9dad44cf0a60570c30c307d949be4cd40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000645c833bfd000000000000000000000000613c64104b98b048b93289ed20aefd80912b3cde0000000000000000000000000000000000000000000000000de123e8a84f9901000000000000000000000000c9371ea30dea5ac745b71e191ba8cde2c4e66df500000000000000000000000000000000000000000000000000000000",
        callGasLimit: "0x7A1200",
        verificationGasLimit: "0x927C0",
        preVerificationGas: "0x15F90",
        maxFeePerGas: "0x956703D00",
        maxPriorityFeePerGas: "0x13AB668000",
        paymasterVerificationGasLimit: "0x927C0",
        paymasterPostOpGasLimit: "0x927C0",
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
        paymaster: await getVerifyingPaymsaterAddress(),
        paymasterData: ethers.concat(
            [
                ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]),
                '0x' + '00'.repeat(65)
            ]
        )
    }

    const smart_account_address = "0xECc88Cc6a3c93AD477C6b72A486C14653803D044"
    const secret = "hello world";
    const nullifier = 0n;
    // await registerUser(smart_account_address, secret, nullifier);

    console.log("Generating proof");
    const proof = await generateProof(smart_account_address, secret, nullifier);
    console.log("Proof generated");

    userOperation.signature = proof;
    console.log("Proof:", proof);
    const tx = await runner.preVerifySignature(userOperation.signature);
    await tx.wait();
    // dummySignature = "0x" + "f".repeat(proof.length - 2);

    // console.log("userOperation.signature:", userOperation.signature);

    // const RunnerFactoryContract = await ethers.getContractAt("RunnerFactory", await getAccountFactoryAddress());
    // const callData = RunnerFactoryContract.interface.encodeFunctionData("runnerImplementation")

    // deploy a new contract
    // const HelloWorldContract = (await ethers.getContractFactory("HelloWorld"));
    // const callData = await HelloWorldContract.getDeployTransaction("Hello, world");
    const counterAddress = "0x59d0d591b90ac342752ea7872d52cdc3c573ab71"
    const counterContract = await ethers.getContractAt("Counter", counterAddress);
    const func = counterContract.interface.encodeFunctionData("increment");

    const runnerExecuteInterfact = new ethers.Interface([
        "function execute(address dest,uint256 value,bytes calldata func) external"
    ]);

    const callData = runnerExecuteInterfact.encodeFunctionData("execute", [counterAddress, 0, func]);

    userOperation.callData = callData;

    const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);

    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
    const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');
    // console.log("User operation:", userOp1.paymasterData);

    const packedUserOp = packUserOp(userOp1);
    // console.log("Packed user operation:", packedUserOp);

    const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);

    const sig = await signer.signMessage(ethers.getBytes(hash));
    console.log("userOperation", userOperation);
    // delete userOperation.nonce;
    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)


    UserOp.nonce = "0x" + UserOp.nonce.toString();
    console.log("User operation:", UserOp);

    delete UserOp.initCode
    // console.log("User operation:", UserOp);


    const options1 = {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_sendUserOperation',
            params: [UserOp, "0x0000000071727De22E5E9d8BAf0edAc6f37da032"]
        })
    };

    try {
        const response = await fetch('https://polygon-amoy.g.alchemy.com/v2/VG6iwUaOlQPYcDCb3AlkyAxrAXF7UzU9', options1)
        // console.log("response:", response);
        const data = await response.json();
        console.log(data);
    }
    catch (error) {
        console.error(error);
        throw error;
    }

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