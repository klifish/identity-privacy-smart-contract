
const { ethers } = require('hardhat');

const { generateProof, registerUser } = require('./registerUser');
const { getVerifyingPaymsaterAddress, getFirstRunnerAddress, getAccountFactoryAddress } = require('./deploy/isDeployed');
const { depositToRunner, withdrawAllFromRunner } = require('./runnerInteraction');
const { getUserOpHash, getDefaultUserOp, getCallData, fillUserOp, packUserOp } = require('./userOp');

const fs = require("fs");

const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;
const { MOCK_VALID_UNTIL, MOCK_VALID_AFTER, ENTRY_POINT_ADDRESS } = require('./sharedConstants');

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const secret = "hello world"

const alchemyProvider = new ethers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);


async function sendUserOperation() {
    const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

    // const runnerAddress = await getFirstRunnerAddress();
    // const runner = await ethers.getContractAt("Runner", runnerAddress);
    // console.log("Runner address:", runnerAddress);

    // let userOperation = {
    //     sender: runnerAddress,
    //     callData: "0xb61d27f600000000000000000000000043f6bfbe9dad44cf0a60570c30c307d949be4cd40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000645c833bfd000000000000000000000000613c64104b98b048b93289ed20aefd80912b3cde0000000000000000000000000000000000000000000000000de123e8a84f9901000000000000000000000000c9371ea30dea5ac745b71e191ba8cde2c4e66df500000000000000000000000000000000000000000000000000000000",
    //     callGasLimit: "0x7A1200",
    //     verificationGasLimit: "0x927C0",
    //     preVerificationGas: "0x15F90",
    //     maxFeePerGas: "0x956703D00",
    //     maxPriorityFeePerGas: "0x13AB668000",
    //     paymasterVerificationGasLimit: "0x927C0",
    //     paymasterPostOpGasLimit: "0x927C0",
    //     signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
    //     paymaster: await getVerifyingPaymsaterAddress(),
    //     paymasterData: ethers.concat(
    //         [
    //             ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]),
    //             '0x' + '00'.repeat(65)
    //         ]
    //     )
    // }

    // const smart_account_address = "0xECc88Cc6a3c93AD477C6b72A486C14653803D044"
    // const secret = "hello world";
    // const nullifier = 0n;
    // await registerUser(smart_account_address, secret, nullifier);

    // console.log("Generating proof");
    // const proof = await generateProof(smart_account_address, secret, nullifier);
    // console.log("Proof generated");

    // userOperation.signature = proof;
    // console.log("Proof:", proof);
    // const tx = await runner.preVerifySignature(userOperation.signature);
    // await tx.wait();
    // // dummySignature = "0x" + "f".repeat(proof.length - 2);

    // // console.log("userOperation.signature:", userOperation.signature);

    // // const RunnerFactoryContract = await ethers.getContractAt("RunnerFactory", await getAccountFactoryAddress());
    // // const callData = RunnerFactoryContract.interface.encodeFunctionData("runnerImplementation")

    // // deploy a new contract
    // // const HelloWorldContract = (await ethers.getContractFactory("HelloWorld"));
    // // const callData = await HelloWorldContract.getDeployTransaction("Hello, world");
    // const counterAddress = "0x59d0d591b90ac342752ea7872d52cdc3c573ab71"
    // const counterContract = await ethers.getContractAt("Counter", counterAddress);
    // const func = counterContract.interface.encodeFunctionData("increment");

    // const runnerExecuteInterfact = new ethers.Interface([
    //     "function execute(address dest,uint256 value,bytes calldata func) external"
    // ]);

    // const callData = runnerExecuteInterfact.encodeFunctionData("execute", [counterAddress, 0, func]);

    // userOperation.callData = callData;

    // const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    // const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);

    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
    // const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');
    // // console.log("User operation:", userOp1.paymasterData);

    // const packedUserOp = packUserOp(userOp1);
    // // console.log("Packed user operation:", packedUserOp);

    // const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);

    // const sig = await signer.signMessage(ethers.getBytes(hash));
    // console.log("userOperation", userOperation);
    // // delete userOperation.nonce;
    // const UserOp = await fillUserOp({
    //     ...userOperation,
    //     paymaster: verifyingPaymasterAddress,
    //     paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    // }, entryPoint)


    // UserOp.nonce = "0x" + UserOp.nonce.toString();
    // console.log("User operation:", UserOp);

    // delete UserOp.initCode
    // // console.log("User operation:", UserOp);

    let UserOp = {
        sender: '0x7a8D610A51C988E7c621d4Ff048845b48476D6b6',
        nonce: '0x25',
        initCode: '0x',
        callData: '0xb61d27f6000000000000000000000000330f8c3d4809534ba5381750be1af9c8c4d47d5f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001c4bb6e19720000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000086e6577206461746100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001202f9fb688026162a6f6d8d92004b234e26e850688154ea8f4e48ce8bed8f77f5510132fbb0acc585ed45d91cb919da4b3e85d428fbdfc9ac119fb7b96c8c1ecbe12d0c17d1423b5fd1fd46702ca09707eec757d60967e454e1279eb556f27dc7719bd00fd371533bf6535b25b28e9f2c455bd0982c8644f0be1b9b026a1b4e39819e74e26fd6b78ecda588c23700f25b8e0b5b5aff8d5dc64fd8bf22010f893a31d9a0b535da688514dad7faee0a5d07e54612b8c9b8699f69142d4f6b66709ad20c7886de0acb324d331400d6267614cbb607c62042493c805208cee8280a4090891c75149874b7abeb1b9a6e7948e93895b399d38227ee02844bffde76c84062d1f866f467e818aac84fef95e12d5d6f22a9e36ef00006a45434d9a052a82d900000000000000000000000000000000000000000000000000000000',
        callGasLimit: '0x7A1200',
        verificationGasLimit: '0xc350',
        preVerificationGas: '0x25F90',
        maxFeePerGas: '0x956703D00',
        maxPriorityFeePerGas: '0x13AB668000',
        paymaster: '0xCB0bF4e57FeCDCa8d4e2fED075e5a1442909fc09',
        paymasterData: '0x00000000000000000000000000000000000000000000000000000000deadbeef00000000000000000000000000000000000000000000000000000000000012343140df4bd4dac3ff76657a2ea368f6644e710c9999a6818b5077746cfb1b37084f075109b63238605fc5a6e9c2b6b88e9ca4b16f381bd8f31166264219ee74071c',
        paymasterVerificationGasLimit: '0x927C',
        paymasterPostOpGasLimit: '0x927C0',
        signature: '0x2013676fa32e49de382d837e8f7c435d567b1293fa4fc4b0387e25a6c06c5f902883e8b0e6501a68fc8246e5bed65bd91cb5e21fe8ff2d7dd56e6c34811648791e68900f6d1634e4c141a4b72cddec10b78c5fa425f987d4419e9380735e7a8f19aaeece66f0ff63b5d1a731967da01519f2a46d1f6c8a83d2855f4b5f567b3b2867301e84f977428f13c7a8c2cf6445bc319e2938ab603b797b30c2b4a79d4628d8d1ce88ca0a84b2ee35a5a5cbfdabb6ba148adc1361456f6acc5e5ddf4bc31cf8c66d5b6acc9981742552e843f2b726c14b17e7d2286b629397c8dcc53e9810352b694a58a2b38a49be3fddafa4aec8981c26fda8581a6bb597c2825e93301e0a59dac02033b1c57afd38e36dcc61630a487fc1931c61f70c37632cfb3891000000000000000000000000000000000000000000000000000000003ade68b1'
    }

    const userOpHashLocal = getUserOpHash(UserOp, ENTRY_POINT_ADDRESS, 80002);
    console.log("User operation hash local:", userOpHashLocal);

    const runnerAddress = await getFirstRunnerAddress();
    const runner = await ethers.getContractAt("Runner", runnerAddress);

    const tx = await runner.preVerifySignature(UserOp.signature, userOpHashLocal);
    await tx.wait();
    console.log("User operation signature verified");




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

// const PROOF = "0x0c18ce0a9a007d3b7f3bb31f282278d53e172f0b036c4be3743515176117efd42098d61be467dbb51e7cc960ab8a80f280cb790205dc623022dfe54657097729040f88b43abe143d339a22ebbc681cd4b2c75ab4070a2ab375630b7cbc99fbcd3030047032e8e44985fcd327d9f7a3b75eb654f11c73128833b42f99da4f3bf11a5670423292abd350c997f193073516a50ea5c750e0a5367aa9bedee7328c611c1e1c70a342e9a05ca1152488d1ee4be30d045c3089adde3897477483885f292a44a4e974d90dfad940b02afccba410c5deaf33e4dbfa9ec6b906357825933705d0609adfa18a7ea728a162cd5acebed1e1d0658b41eaf7209350468d555e251191f8b446226ae7fdc9a1fa89655591430bd8b96bd1f7f73f8161351a232c58000000000000000000000000000000000000000000000000000000003ade68b1"

// async function runnerVerify() {
//     const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
//     const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

//     const RunnerContract = await ethers.getContractFactory("Runner", signer);
//     const runnerAddress = await getFirstRunnerAddress();
//     console.log("Runner address:", runnerAddress);
//     const runner = RunnerContract.attach(runnerAddress);

//     const entryPoint = await runner.entryPoint();
//     console.log("Entry point:", entryPoint);

//     console.log("Verifying proof on chain");
//     // const gasLimit = ethers.utils.hexlify(1000000);
//     const verificationResult = await runner.verifyProof(PROOF, { gasLimit: 1000000 });
//     verificationResult.wait();

//     const decodedProof = await runner._deserializeProofAndPublicSignals(PROOF);
//     console.log("Decoded proof:", decodedProof);


// }
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