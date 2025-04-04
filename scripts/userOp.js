const { ethers } = require('hardhat');
const EntryPointSimulationsJson = require("../test/EntryPointSimulations.json");

function getDefaultUserOp(sender, paymaster) {
    return {
        sender: sender,
        callData: "0xb61d27f600000000000000000000000043f6bfbe9dad44cf0a60570c30c307d949be4cd40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000645c833bfd000000000000000000000000613c64104b98b048b93289ed20aefd80912b3cde0000000000000000000000000000000000000000000000000de123e8a84f9901000000000000000000000000c9371ea30dea5ac745b71e191ba8cde2c4e66df500000000000000000000000000000000000000000000000000000000",
        callGasLimit: "0x7A1200",
        verificationGasLimit: "0x927C0",
        preVerificationGas: "0x15F90",
        maxFeePerGas: "0x956703D00",
        maxPriorityFeePerGas: "0x13AB668000",
        paymasterVerificationGasLimit: "0x927C0",
        paymasterPostOpGasLimit: "0x927C0",
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
        paymaster: paymaster,
        paymasterData: ethers.concat(
            [
                ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]),
                '0x' + '00'.repeat(65)
            ]
        )
    }
}

function getCallData(dest, value, func) {
    const runnerExecuteInterfact = new ethers.Interface([
        "function execute(address dest,uint256 value,bytes calldata func) external"
    ]);

    const callData = runnerExecuteInterfact.encodeFunctionData("execute", [dest, value, func]);
    return callData;
}

const DefaultsForUserOp = {
    sender: ethers.AddressZero,
    nonce: 0,
    initCode: '0x',
    callData: '0x',
    callGasLimit: 0,
    verificationGasLimit: 150000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
    preVerificationGas: 21000, // should also cover calldata cost.
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 1e9,
    paymaster: ethers.AddressZero,
    paymasterData: '0x',
    paymasterVerificationGasLimit: 3e5,
    paymasterPostOpGasLimit: 0,
    signature: '0x'
}

function fillUserOpDefaults(op, defaults = DefaultsForUserOp) {
    const partial = { ...op };

    // Remove properties explicitly set to `null` or `undefined`
    for (const key in partial) {
        if (partial[key] == null) {
            delete partial[key];
        }
    }

    // Merge with defaults, using existing values in `partial` over `defaults`
    return { ...defaults, ...partial };
}

function packPaymasterData(paymaster, paymasterVerificationGasLimit, postOpGasLimit, paymasterData) {
    return ethers.concat([
        paymaster,
        ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
        ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
        paymasterData
    ]);
}

function packAccountGasLimits(verificationGasLimit, callGasLimit) {
    let verificationGasLimitHex = ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16);
    let callGasLimitHex = ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16);
    return ethers.concat([verificationGasLimitHex, callGasLimitHex]);
}

function packUserOp(userOp) {
    const accountGasLimits = packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit);
    const gasFees = packAccountGasLimits(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas);

    let paymasterAndData = '0x';
    if (userOp.paymaster && userOp.paymaster.length >= 20 && userOp.paymaster !== ethers.AddressZero) {
        paymasterAndData = packPaymasterData(userOp.paymaster, userOp.paymasterVerificationGasLimit, userOp.paymasterPostOpGasLimit, userOp.paymasterData);
    }

    return {
        sender: userOp.sender,
        nonce: userOp.nonce,
        callData: userOp.callData,
        accountGasLimits,
        initCode: userOp.initCode,
        preVerificationGas: userOp.preVerificationGas,
        gasFees,
        paymasterAndData,
        signature: userOp.signature
    };
}

function encodeUserOp(userOp, forSignature = true) {
    const packedUserOp = packUserOp(userOp);
    if (forSignature) {
        return ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'bytes32', 'bytes32',
                'bytes32', 'uint256', 'bytes32',
                'bytes32'],
            [packedUserOp.sender, packedUserOp.nonce, ethers.keccak256(packedUserOp.initCode), ethers.keccak256(packedUserOp.callData),
            packedUserOp.accountGasLimits, packedUserOp.preVerificationGas, packedUserOp.gasFees,
            ethers.keccak256(packedUserOp.paymasterAndData)]);
    } else {
        return ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'bytes', 'bytes',
                'bytes32', 'uint256', 'bytes32',
                'bytes', 'bytes'],
            [packedUserOp.sender, packedUserOp.nonce, packedUserOp.initCode, packedUserOp.callData,
            packedUserOp.accountGasLimits, packedUserOp.preVerificationGas, packedUserOp.gasFees,
            packedUserOp.paymasterAndData, packedUserOp.signature]);
    }
}

function getUserOpHash(op, entryPoint, chainId) {
    const userOpHash = ethers.keccak256(encodeUserOp(op, true));
    const enc = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [userOpHash, entryPoint, chainId]);

    return ethers.keccak256(enc);
}

async function fillUserOp(op, entryPoint, getNonceFunction = 'getNonce') {

    const op1 = { ...op };
    const provider = entryPoint?.runner?.provider;

    if (op.initCode != null && op.initCode !== "0x") {
        const initAddr = hexDataSlice(op1.initCode, 0, 20);
        const initCallData = hexDataSlice(op1.initCode, 20);
        if (op1.nonce == null) op1.nonce = 0;
        if (op1.sender == null) {
            if (initAddr.toLowerCase() === Create2Factory.contractAddress.toLowerCase()) {
                const ctr = hexDataSlice(initCallData, 32);
                const salt = hexDataSlice(initCallData, 0, 32);
                op1.sender = Create2Factory.getDeployedAddress(ctr, salt);
            } else {
                if (provider == null) throw new Error('no entrypoint/provider');
                try {
                    op1.sender = await entryPoint.callStatic.getSenderAddress(op1.initCode);
                } catch (e) {
                    op1.sender = e.errorArgs.sender;
                }
            }
        }
        if (op1.verificationGasLimit == null) {
            if (provider == null) throw new Error('no entrypoint/provider');
            const initEstimate = await provider.estimateGas({
                from: entryPoint?.address,
                to: initAddr,
                data: initCallData,
                gasLimit: 10e6
            });
            op1.verificationGasLimit = BigNumber.from(DefaultsForUserOp.verificationGasLimit).add(initEstimate);
        }
    }

    if (op1.nonce == null) {
        if (provider == null) throw new Error('must have entryPoint to autofill nonce');
        const c = new ethers.Contract(op.sender, [`function ${getNonceFunction}() view returns(uint256)`], provider);
        try {
            op1.nonce = await c[getNonceFunction]();
        } catch (err) {
            throw err;
        }
    }

    if (op1.callGasLimit == null && op.callData != null) {
        if (provider == null) throw new Error('must have entryPoint for callGasLimit estimate');
        const gasEstimated = await provider.estimateGas({
            from: entryPoint?.address,
            to: op1.sender,
            data: op1.callData
        });
        op1.callGasLimit = gasEstimated;
    }

    if (op1.paymaster != null) {
        if (op1.paymasterVerificationGasLimit == null) {
            op1.paymasterVerificationGasLimit = DefaultsForUserOp.paymasterVerificationGasLimit;
        }
        if (op1.paymasterPostOpGasLimit == null) {
            op1.paymasterPostOpGasLimit = DefaultsForUserOp.paymasterPostOpGasLimit;
        }
    }

    if (op1.maxFeePerGas == null) {
        if (provider == null) throw new Error('must have entryPoint to autofill maxFeePerGas');
        const block = await provider.getBlock('latest');
        op1.maxFeePerGas = block.baseFeePerGas + BigInt(op1.maxPriorityFeePerGas ?? DefaultsForUserOp.maxPriorityFeePerGas);
    }

    if (op1.maxPriorityFeePerGas == null) {
        op1.maxPriorityFeePerGas = DefaultsForUserOp.maxPriorityFeePerGas;
    }

    const op2 = fillUserOpDefaults(op1);
    if (op2.preVerificationGas.toString() === '0') {
        op2.preVerificationGas = callDataCost(encodeUserOp(op2, false));
    }

    return op2;
}

async function fillAndSign(op, signer, entryPoint, getNonceFunction = 'getNonce') {
    const provider = entryPoint?.runner?.provider;
    const op2 = await fillUserOp(op, entryPoint, getNonceFunction);

    const chainId = await provider.getNetwork().then(net => net.chainId);
    const message = ethers.getBytes(getUserOpHash(op2, await entryPoint.getAddress(), chainId));

    let signature;
    try {
        signature = await signer.signMessage(message);
    } catch (err) {
        // attempt to use 'eth_sign' instead of 'personal_sign' which is not supported by Foundry Anvil
        signature = await signer._legacySignMessage(message);
    }
    return {
        ...op2,
        signature
    };
}

async function fillSignAndPack(op, signer, entryPoint, getNonceFunction = "getNonce") {
    const filledAndSignedOp = await fillAndSign(op, signer, entryPoint, getNonceFunction);
    return packUserOp(filledAndSignedOp);
}

async function fillAndPcak(op, entryPoint, getNonceFunction = "getNonce") {
    const filledOp = await fillUserOp(op, entryPoint, getNonceFunction);
    return packUserOp(filledOp);
}

async function simulateValidation(userOp, entryPointAddress, txOverrides = {}) {

    const entryPointSimulations = new ethers.Interface(EntryPointSimulationsJson.abi);
    const data = entryPointSimulations.encodeFunctionData("simulateValidation", [userOp]);

    const tx = {
        to: entryPointAddress,
        data,
        ...txOverrides
    };

    const stateOverride = {
        [entryPointAddress]: {
            code: EntryPointSimulationsJson.deployedBytecode
        }
    };

    try {
        const simulationResult = await ethers.provider.send("eth_call", [tx, "latest", stateOverride]);
        console.log("Simulation result:", simulationResult);
        // if (!simulationResult || typeof simulationResult !== "string" || !simulationResult.startsWith("0x")) {
        //     throw new Error("simulateValidation: Received invalid response from eth_call.");
        // }
        // const res = entryPointSimulations.decodeFunctionResult("simulateValidation", simulationResult);
        // return res[0]; // Extract the first value from the tuple
    } catch (error) {
        const revertData = error?.data;
        if (revertData != null) {
            entryPointSimulations.decodeFunctionResult("simulateValidation", revertData);
        }
        throw error;
    }
}


module.exports = {
    fillUserOpDefaults,
    packAccountGasLimits,
    packPaymasterData,
    getUserOpHash,
    fillUserOp,
    fillAndSign,
    packUserOp,
    fillSignAndPack,
    simulateValidation,
    fillAndPcak,
    getDefaultUserOp,
    getCallData
};