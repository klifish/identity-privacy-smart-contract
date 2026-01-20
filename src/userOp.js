/**
 * UserOperation Module (EIP-4337)
 *
 * Handles UserOperation creation, packing, hashing, and submission
 * @module userOp
 */

const { ethers } = require('ethers');

/**
 * Default values for UserOperation fields
 */
const DefaultsForUserOp = {
  sender: ethers.ZeroAddress,
  nonce: 0,
  initCode: '0x',
  callData: '0x',
  callGasLimit: 0,
  verificationGasLimit: 150000,
  preVerificationGas: 21000,
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymaster: ethers.ZeroAddress,
  paymasterData: '0x',
  paymasterVerificationGasLimit: 3e5,
  paymasterPostOpGasLimit: 0,
  signature: '0x',
};

/**
 * Fill missing UserOperation fields with defaults
 * @param {Object} op - Partial UserOperation
 * @param {Object} defaults - Default values (optional)
 * @returns {Object} - Complete UserOperation
 */
function fillUserOpDefaults(op, defaults = DefaultsForUserOp) {
  const partial = { ...op };

  // Remove null/undefined values
  for (const key in partial) {
    if (partial[key] == null) {
      delete partial[key];
    }
  }

  return { ...defaults, ...partial };
}

/**
 * Pack account gas limits into bytes32
 * @param {number|bigint} verificationGasLimit
 * @param {number|bigint} callGasLimit
 * @returns {string} - Packed bytes32
 */
function packAccountGasLimits(verificationGasLimit, callGasLimit) {
  const verificationGasLimitHex = ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16);
  const callGasLimitHex = ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16);
  return ethers.concat([verificationGasLimitHex, callGasLimitHex]);
}

/**
 * Pack paymaster data
 * @param {string} paymaster - Paymaster address
 * @param {number|bigint} paymasterVerificationGasLimit
 * @param {number|bigint} postOpGasLimit
 * @param {string} paymasterData - Additional data
 * @returns {string} - Packed paymaster data
 */
function packPaymasterData(paymaster, paymasterVerificationGasLimit, postOpGasLimit, paymasterData) {
  return ethers.concat([
    paymaster,
    ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
    paymasterData,
  ]);
}

/**
 * Pack UserOperation into EIP-4337 v0.7 format
 * @param {Object} userOp - UserOperation object
 * @returns {Object} - Packed UserOperation
 */
function packUserOp(userOp) {
  const accountGasLimits = packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit);
  const gasFees = packAccountGasLimits(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas);

  let paymasterAndData = '0x';
  if (userOp.paymaster && userOp.paymaster.length >= 20 && userOp.paymaster !== ethers.ZeroAddress) {
    paymasterAndData = packPaymasterData(
      userOp.paymaster,
      userOp.paymasterVerificationGasLimit,
      userOp.paymasterPostOpGasLimit,
      userOp.paymasterData
    );
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
    signature: userOp.signature,
  };
}

/**
 * Encode UserOperation for hashing/signing
 * @param {Object} userOp - UserOperation object
 * @param {boolean} forSignature - Whether encoding for signature
 * @returns {string} - Encoded data
 */
function encodeUserOp(userOp, forSignature = true) {
  const packedUserOp = packUserOp(userOp);

  if (forSignature) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'],
      [
        packedUserOp.sender,
        packedUserOp.nonce,
        ethers.keccak256(packedUserOp.initCode),
        ethers.keccak256(packedUserOp.callData),
        packedUserOp.accountGasLimits,
        packedUserOp.preVerificationGas,
        packedUserOp.gasFees,
        ethers.keccak256(packedUserOp.paymasterAndData),
      ]
    );
  } else {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes', 'bytes', 'bytes32', 'uint256', 'bytes32', 'bytes', 'bytes'],
      [
        packedUserOp.sender,
        packedUserOp.nonce,
        packedUserOp.initCode,
        packedUserOp.callData,
        packedUserOp.accountGasLimits,
        packedUserOp.preVerificationGas,
        packedUserOp.gasFees,
        packedUserOp.paymasterAndData,
        packedUserOp.signature,
      ]
    );
  }
}

/**
 * Calculate UserOperation hash
 * @param {Object} op - UserOperation object
 * @param {string} entryPoint - EntryPoint contract address
 * @param {number|bigint} chainId - Chain ID
 * @returns {string} - UserOperation hash
 */
function getUserOpHash(op, entryPoint, chainId) {
  const userOpHash = ethers.keccak256(encodeUserOp(op, true));
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHash, entryPoint, chainId]
  );
  return ethers.keccak256(enc);
}

/**
 * Generate call data for account execute function
 * @param {string} dest - Destination address
 * @param {number|bigint} value - ETH value to send
 * @param {string} func - Encoded function call data
 * @returns {string} - Encoded execute call data
 */
function getCallData(dest, value, func) {
  const executeInterface = new ethers.Interface([
    'function execute(address dest, uint256 value, bytes calldata func) external',
  ]);
  return executeInterface.encodeFunctionData('execute', [dest, value, func]);
}

/**
 * Create a default UserOperation template
 * @param {string} sender - Sender address
 * @param {string} paymaster - Paymaster address
 * @param {Object} options - Additional options
 * @returns {Object} - UserOperation template
 */
function getDefaultUserOp(sender, paymaster, options = {}) {
  const { validUntil = 0, validAfter = 0 } = options;

  return {
    sender,
    callData: '0x',
    callGasLimit: '0x7A1200',
    verificationGasLimit: '0x186A0',
    preVerificationGas: '0x25F90',
    maxFeePerGas: '0x956703D00',
    maxPriorityFeePerGas: '0x13AB668000',
    paymasterVerificationGasLimit: '0x927C',
    paymasterPostOpGasLimit: '0x927C0',
    signature: '0x',
    paymaster,
    paymasterData: ethers.concat([
      ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [validUntil, validAfter]),
      '0x' + '00'.repeat(65),
    ]),
  };
}

/**
 * UserOperation client for building and sending operations
 */
class UserOpClient {
  /**
   * Create a UserOpClient
   * @param {Object} config - Configuration
   * @param {string} config.rpcUrl - RPC endpoint
   * @param {string} config.bundlerUrl - Bundler endpoint
   * @param {string} config.entryPointAddress - EntryPoint contract address
   * @param {number} config.chainId - Chain ID
   */
  constructor(config) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.bundlerUrl = config.bundlerUrl;
    this.entryPointAddress = config.entryPointAddress;
    this.chainId = config.chainId;
  }

  /**
   * Calculate UserOp hash
   * @param {Object} userOp - UserOperation
   * @returns {string} - Hash
   */
  getUserOpHash(userOp) {
    return getUserOpHash(userOp, this.entryPointAddress, this.chainId);
  }

  /**
   * Pack a UserOperation
   * @param {Object} userOp - UserOperation
   * @returns {Object} - Packed UserOp
   */
  packUserOp(userOp) {
    return packUserOp(userOp);
  }

  /**
   * Fill UserOp with defaults and estimate gas
   * @param {Object} userOp - Partial UserOperation
   * @param {string} getNonceFunction - Function name to get nonce
   * @returns {Promise<Object>} - Filled UserOperation
   */
  async fillUserOp(userOp, getNonceFunction = 'getNonce') {
    const op1 = { ...userOp };

    // Get nonce if not provided
    if (op1.nonce == null) {
      const accountContract = new ethers.Contract(
        op1.sender,
        [`function ${getNonceFunction}() view returns(uint256)`],
        this.provider
      );
      op1.nonce = await accountContract[getNonceFunction]();
    }

    // Estimate callGasLimit if not provided
    if (op1.callGasLimit == null && op1.callData != null) {
      const gasEstimated = await this.provider.estimateGas({
        from: this.entryPointAddress,
        to: op1.sender,
        data: op1.callData,
      });
      op1.callGasLimit = gasEstimated;
    }

    // Set paymaster gas limits if paymaster is set
    if (op1.paymaster != null) {
      if (op1.paymasterVerificationGasLimit == null) {
        op1.paymasterVerificationGasLimit = DefaultsForUserOp.paymasterVerificationGasLimit;
      }
      if (op1.paymasterPostOpGasLimit == null) {
        op1.paymasterPostOpGasLimit = DefaultsForUserOp.paymasterPostOpGasLimit;
      }
    }

    // Get gas prices if not provided
    if (op1.maxFeePerGas == null) {
      const block = await this.provider.getBlock('latest');
      op1.maxFeePerGas =
        block.baseFeePerGas + BigInt(op1.maxPriorityFeePerGas ?? DefaultsForUserOp.maxPriorityFeePerGas);
    }

    if (op1.maxPriorityFeePerGas == null) {
      op1.maxPriorityFeePerGas = DefaultsForUserOp.maxPriorityFeePerGas;
    }

    return fillUserOpDefaults(op1);
  }

  /**
   * Send UserOperation to bundler
   * @param {Object} userOp - UserOperation to send
   * @returns {Promise<Object>} - Bundler response
   */
  async sendUserOperation(userOp) {
    const response = await fetch(this.bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_sendUserOperation',
        params: [userOp, this.entryPointAddress],
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Bundler Error: ${data.error.message || 'Unknown error'}`);
    }

    return data;
  }

  /**
   * Wait for UserOperation to be packed
   * @param {string} userOpHash - UserOperation hash
   * @param {number} maxAttempts - Max retry attempts
   * @param {number} delayMs - Delay between retries
   * @returns {Promise<string>} - Transaction hash
   */
  async waitForUserOperation(userOpHash, maxAttempts = 20, delayMs = 3000) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(this.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_getUserOperationByHash',
          params: [userOpHash],
        }),
      });

      const data = await response.json();
      if (data.result && data.result.transactionHash) {
        return data.result.transactionHash;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error('Timeout: UserOperation was not packed by bundler.');
  }
}

module.exports = {
  DefaultsForUserOp,
  fillUserOpDefaults,
  packAccountGasLimits,
  packPaymasterData,
  packUserOp,
  encodeUserOp,
  getUserOpHash,
  getCallData,
  getDefaultUserOp,
  UserOpClient,
};
