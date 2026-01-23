/**
 * Zero-Knowledge Proof Module
 *
 * Handles ZKP generation and verification for identity proofs
 * @module zkp
 */

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');
const { ethers } = require('ethers');
const ffjavascript = require('ffjavascript');
const circomlibjs = require('circomlibjs');
const MerkleTree = require('fixed-merkle-tree').MerkleTree;
const { pedersenHashMultipleInputs, groth16ExportSolidityCallData } = require('./utils');

/**
 * ZKP Client for generating and verifying proofs
 */
class ZKPClient {
  /**
   * Create a ZKPClient
   * @param {Object} config - Configuration
   * @param {string} config.circuitsPath - Path to circuits build folder
   * @param {number} config.merkleTreeLevel - Merkle tree depth (default: 20)
   */
  constructor(config) {
    this.circuitsPath = config.circuitsPath || path.join(__dirname, '..', 'build', 'circuits');
    this.merkleTreeLevel = config.merkleTreeLevel || 20;
    this.hasher = null;
  }

  /**
   * Initialize the hasher for Merkle tree
   */
  async initHasher() {
    if (!this.hasher) {
      const mimcsponge = await circomlibjs.buildMimcSponge();
      this.hasher = {
        hash: (left, right) => {
          return mimcsponge.F.toString(mimcsponge.multiHash([BigInt(left), BigInt(right)]));
        },
      };
    }
    return this.hasher;
  }

  /**
   * Hash two values for Merkle tree (Poseidon/MiMC style)
   * @param {bigint|string} left
   * @param {bigint|string} right
   * @returns {Promise<string>}
   */
  async hashLeftRight(left, right) {
    const hasher = await this.initHasher();
    return hasher.hash(left, right);
  }

  /**
   * Calculate Merkle tree leaf from credentials
   * @param {string} smartAccountAddress - Smart account address
   * @param {string} secret - User secret
   * @param {bigint} nullifier - Nullifier value
   * @returns {Promise<bigint>} - Leaf value
   */
  async calculateLeaf(secret, nullifier) {
    const secretBuff = new TextEncoder().encode(secret);
    const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff);

    const src = [secretBigInt, nullifier];
    const srcHash = await pedersenHashMultipleInputs(src);

    const babyjub = await circomlibjs.buildBabyjub();
    const hP = babyjub.unpackPoint(srcHash);
    return babyjub.F.toObject(hP[1]);
  }

  /**
   * Generate registration proof (Merkle tree membership)
   * @param {Object} params - Proof parameters
   * @param {string} params.smartAccountAddress - Smart account address
   * @param {string} params.secret - User secret
   * @param {bigint} params.nullifier - Nullifier
   * @param {Array<bigint>} params.leaves - All leaves in the tree
   * @returns {Promise<{proof: string, publicInputs: Array}>}
   */
  async generateRegistrationProof(params) {
    const { secret, nullifier, leaves } = params;

    const wasmPath = path.join(this.circuitsPath, 'register_js', 'register.wasm');
    const zkeyPath = path.join(this.circuitsPath, 'register_final.zkey');

    // Calculate the user's leaf
    const leaf = await this.calculateLeaf(secret, nullifier);

    // Build Merkle tree
    const hasher = await this.initHasher();
    const tree = new MerkleTree(this.merkleTreeLevel, leaves, {
      hashFunction: (left, right) => hasher.hash(left, right),
    });

    // Get Merkle proof
    const merkleProof = tree.proof(leaf);

    // Prepare circuit input
    const secretBuff = new TextEncoder().encode(secret);
    const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff);

    const input = {
      root: merkleProof.pathRoot,
      nullifierHash: '987654321', // Can be customized
      recipient: '100',
      relayer: '50',
      fee: '10',
      refund: '5',
      nullifier: nullifier,
      secret: secretBigInt,
      pathElements: merkleProof.pathElements,
      pathIndices: merkleProof.pathIndices,
    };

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    // Export to Solidity format
    const { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proof, publicSignals);

    // Encode for contract call
    const serializedProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint[2]', 'uint[2][2]', 'uint[2]', 'uint[2]'],
      [pA, pB, pC, pubSignals]
    );

    return {
      proof: serializedProof,
      proofComponents: { pA, pB, pC, pubSignals },
      publicInputs: publicSignals,
      root: merkleProof.pathRoot,
    };
  }

  /**
   * Generate commitment proof (for data access)
   * @param {string} secret - User secret
   * @param {string} domain - Domain separator (optional)
   * @returns {Promise<{proof: string, publicInputs: Array}>}
   */
  async generateCommitmentProof(secret, domain = '') {
    const wasmPath = path.join(this.circuitsPath, 'commitment_js', 'commitment.wasm');
    const zkeyPath = path.join(this.circuitsPath, 'commitment_final.zkey');

    const encodedMessage = new TextEncoder().encode(secret + domain);
    const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

    const input = { secret: encodedMessageBigInt };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    const { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proof, publicSignals);

    const serializedProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint[2]', 'uint[2][2]', 'uint[2]', 'uint[1]'],
      [pA, pB, pC, pubSignals]
    );

    return {
      proof: serializedProof,
      proofComponents: { pA, pB, pC, pubSignals },
      publicInputs: publicSignals,
    };
  }

  /**
   * Verify proof locally using verification key
   * @param {Object} proof - Proof object from snarkjs
   * @param {Array} publicSignals - Public signals
   * @param {string} circuitName - 'register' or 'commitment'
   * @returns {Promise<boolean>}
   */
  async verifyProofLocally(proof, publicSignals, circuitName) {
    const vkeyPath = path.join(this.circuitsPath, `${circuitName}_vk.json`);
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    return snarkjs.groth16.verify(vkey, publicSignals, proof);
  }
}

/**
 * Generate registration proof (standalone function)
 * @param {Object} config - Configuration with circuitsPath
 * @param {Object} params - Proof parameters
 * @returns {Promise<Object>}
 */
async function generateRegistrationProof(config, params) {
  const client = new ZKPClient(config);
  return client.generateRegistrationProof(params);
}

/**
 * Generate commitment proof (standalone function)
 * @param {Object} config - Configuration with circuitsPath
 * @param {string} secret - User secret
 * @param {string} domain - Domain separator
 * @returns {Promise<Object>}
 */
async function generateCommitmentProof(config, secret, domain = '') {
  const client = new ZKPClient(config);
  return client.generateCommitmentProof(secret, domain);
}

module.exports = {
  ZKPClient,
  generateRegistrationProof,
  generateCommitmentProof,
};
