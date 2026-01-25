/**
 * Utility functions for Identity Privacy SDK
 * @module utils
 */

const { ethers } = require('ethers');
const snarkjs = require('snarkjs');
const circomlibjs = require('circomlibjs');
const ffjavascript = require('ffjavascript');

let pedersenInstance;
let babyjubInstance;

/**
 * Initialize cryptographic instances (lazy loading)
 */
async function initCrypto() {
  if (!pedersenInstance) {
    pedersenInstance = await circomlibjs.buildPedersenHash();
  }
  if (!babyjubInstance) {
    babyjubInstance = await circomlibjs.buildBabyjub();
  }
  return { pedersen: pedersenInstance, babyjub: babyjubInstance };
}

/**
 * Compute Pedersen hash for multiple inputs
 * @param {Array<bigint|string|number>} inputs - Array of inputs to hash
 * @returns {Promise<Uint8Array>} - Hash result as Uint8Array
 */
async function pedersenHashMultipleInputs(inputs) {
  if (!Array.isArray(inputs)) {
    throw new Error('Inputs must be an array.');
  }

  const { pedersen } = await initCrypto();

  // Convert all inputs to 32-byte Uint8Array format
  const buffers = inputs.map((input) => {
    const bigintInput = BigInt(input);
    return ffjavascript.utils.leInt2Buff(bigintInput, 32);
  });

  // Concatenate all Uint8Arrays
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const concatenatedBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    concatenatedBuffer.set(buffer, offset);
    offset += buffer.length;
  }

  // Compute hash
  return pedersen.hash(concatenatedBuffer);
}

/**
 * Compute Pedersen hash for a string message
 * @param {string} message - Message to hash
 * @returns {Promise<bigint>} - Hash result as BigInt
 */
async function computePedersenHash(message) {
  if (typeof message !== 'string' || message.length === 0) {
    throw new Error('Message must be a non-empty string.');
  }

  const { pedersen, babyjub } = await initCrypto();

  // Convert message to Uint8Array (padded to 32 bytes)
  const encodedMessage = new TextEncoder().encode(message);
  const encodedMessage32 = new Uint8Array(32);
  encodedMessage32.set(encodedMessage);

  // Compute hash
  const hashBuffer = pedersen.hash(encodedMessage32);
  return ffjavascript.utils.leBuff2int(hashBuffer);
}

/**
 * Convert bits array to BigInt
 * @param {Array<number>} bits - Array of 0s and 1s
 * @returns {bigint} - Resulting number
 */
function bitsToNum(bits) {
  if (!Array.isArray(bits)) {
    throw new Error('Input must be an array.');
  }

  let num = 0n;
  let weight = 1n;

  for (const bit of bits) {
    if (bit !== 0 && bit !== 1) {
      throw new Error('Bits array must contain only 0 or 1.');
    }
    if (bit === 1) {
      num += weight;
    }
    weight *= 2n;
  }

  return num;
}

/**
 * Convert BigInt to bits array
 * @param {bigint} inValue - Input value
 * @param {number} n - Number of bits
 * @returns {Array<number>} - Bits array
 */
function numToBits(inValue, n) {
  if (typeof inValue !== 'bigint') {
    throw new Error(`Input value must be a BigInt. Received: ${typeof inValue}`);
  }

  const out = new Array(n).fill(0n);
  let lc1 = 0n;
  let e2 = 1n;

  for (let i = 0; i < n; i++) {
    out[i] = (inValue >> BigInt(i)) & 1n;
    lc1 += out[i] * e2;
    e2 *= 2n;
  }

  if (lc1 !== inValue) {
    throw new Error(`Validation failed: lc1 (${lc1}) !== inValue (${inValue})`);
  }

  return out.map(Number);
}

/**
 * Convert address to 32-byte Uint8Array
 * @param {string} address - Ethereum address
 * @returns {Uint8Array} - 32-byte array
 */
function address2Uint8Array32(address) {
  const addressBigInt = BigInt(address);
  const addressBits = numToBits(addressBigInt, 256);
  const addressBigIntFromBits = bitsToNum(addressBits);
  const addressBuff = ffjavascript.utils.leInt2Buff(addressBigIntFromBits);

  const ret = new Uint8Array(32);
  for (let i = 0; i < addressBuff.length; i++) {
    ret[i + 12] = addressBuff[i];
  }
  return ret;
}

/**
 * Format a number to 256-bit hex string
 * @param {bigint|string|number} n - Number to format
 * @returns {string} - Hex string with 0x prefix
 */
function p256(n) {
  let nstr = BigInt(n).toString(16);
  while (nstr.length < 64) nstr = '0' + nstr;
  return `0x${nstr}`;
}

/**
 * Export Groth16 proof to Solidity-compatible call data
 * @param {Object} proof - Proof object from snarkjs
 * @param {Array} publicSignals - Public signals array
 * @returns {Promise<Object>} - Object with pA, pB, pC, pubSignals
 */
async function groth16ExportSolidityCallData(proof, publicSignals) {
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const argv = calldata
    .replace(/"|\[|\]|\s/g, '')
    .split(',')
    .filter((x) => x.length > 0)
    .map((x) => BigInt(x).toString());

  const pA = [argv[0], argv[1]];
  const pB = [
    [argv[2], argv[3]],
    [argv[4], argv[5]],
  ];
  const pC = [argv[6], argv[7]];
  const pubSignals = argv.slice(8);

  return { pA, pB, pC, pubSignals };
}

/**
 * Create an ethers.js provider
 * @param {string} rpcUrl - RPC endpoint URL
 * @returns {ethers.JsonRpcProvider} - Provider instance
 */
function createProvider(rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Create an ethers.js signer from private key
 * @param {string} privateKey - Private key
 * @param {ethers.Provider} provider - Provider instance
 * @returns {ethers.Wallet} - Wallet/signer instance
 */
function createSigner(privateKey, provider) {
  return new ethers.Wallet(privateKey, provider);
}

module.exports = {
  initCrypto,
  pedersenHashMultipleInputs,
  computePedersenHash,
  bitsToNum,
  numToBits,
  address2Uint8Array32,
  p256,
  groth16ExportSolidityCallData,
  createProvider,
  createSigner,
};
