const { ethers } = require('hardhat');

export function fillUserOpDefaults(op, defaults = DefaultsForUserOp) {
    const partial = { ...op };

    for (const key in partial) {
        if (partial[key] == null) {
            delete partial[key];
        }
    }
    const filled = { ...defaults, ...partial };
    return filled;
}

export function packAccountGasLimits(verificationGasLimit, callGasLimit) {
    return ethers.utils.hexConcat([
        ethers.utils.hexZeroPad(ethers.utils.hexlify(verificationGasLimit, { hexPad: 'left' }), 16),
        ethers.utils.hexZeroPad(ethers.utils.hexlify(callGasLimit, { hexPad: 'left' }), 16)
    ]);
}

export function packPaymasterData(paymaster, paymasterVerificationGasLimit, postOpGasLimit, paymasterData) {
    return ethers.utils.hexConcat([
        paymaster,
        ethers.utils.hexZeroPad(ethers.utils.hexlify(paymasterVerificationGasLimit, { hexPad: 'left' }), 16),
        ethers.utils.hexZeroPad(ethers.utils.hexlify(postOpGasLimit, { hexPad: 'left' }), 16),
        paymasterData
    ]);
}

export function getUserOpHash(op, entryPoint, chainId) {
    const userOpHash = ethers.keccak256;
}