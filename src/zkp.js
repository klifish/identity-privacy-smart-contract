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

const FIELD_SIZE = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

function hashLeftRightSync(hasher, left, right) {
  const { mimcsponge, F } = hasher;
  const leftBigInt = BigInt(left);
  const rightBigInt = BigInt(right);

  if (leftBigInt >= FIELD_SIZE) throw new Error('_left should be inside the field');
  if (rightBigInt >= FIELD_SIZE) throw new Error('_right should be inside the field');

  const hash = mimcsponge.multiHash([leftBigInt, rightBigInt], 0, 1);
  return F.toObject(hash);
}

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
        mimcsponge,
        F: mimcsponge.F,
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
    return hashLeftRightSync(hasher, left, right);
  }

  /**
   * Calculate Merkle tree leaf from credentials
   * @param {string} smartAccountAddress - Smart account address
   * @param {string} secret - User secret
   * @param {bigint} nullifier - Nullifier value
   * @returns {Promise<bigint>} - Leaf value
   */
  async calculateLeaf(secret, nullifier) {
    const secretBigInt = normalizeToFieldElement(parseSecretToBigInt(secret));
    const nullifierBigInt = normalizeToFieldElement(BigInt(nullifier));

    const src = [secretBigInt, nullifierBigInt];
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

    const merkleProof = await this.buildMerkleProof({ secret, nullifier, leaves });

    // Prepare circuit input
    const secretBigInt = normalizeToFieldElement(parseSecretToBigInt(secret));
    const nullifierBigInt = normalizeToFieldElement(BigInt(nullifier));

    const input = {
      root: merkleProof.pathRoot,
      nullifierHash: '987654321', // Can be customized
      recipient: '100',
      relayer: '50',
      fee: '10',
      refund: '5',
      nullifier: nullifierBigInt,
      secret: secretBigInt,
      pathElements: merkleProof.pathElements,
      pathIndices: merkleProof.pathIndices,
    };

    // Generate proof
    const t0 = Date.now();
    console.log('[zkp] fullProve start', { wasmPath, zkeyPath, leaves: leaves.length });
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    console.log('[zkp] fullProve done', { ms: Date.now() - t0 });

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
   * Build Merkle proof without generating a SNARK
   * @param {Object} params - Proof parameters
   * @returns {Promise<{leaf: bigint, pathRoot: bigint, pathElements: Array, pathIndices: Array, leafIndex: number}>}
   */
  async buildMerkleProof(params) {
    const { secret, nullifier, leaves } = params;

    const leaf = await this.calculateLeaf(secret, nullifier);
    const hasher = await this.initHasher();
    const tree = new MerkleTree(this.merkleTreeLevel, leaves, {
      hashFunction: (left, right) => hashLeftRightSync(hasher, left, right),
    });

    const merkleProof = tree.proof(leaf);
    const leafIndex = tree.indexOf(leaf);

    return {
      leaf,
      pathRoot: merkleProof.pathRoot,
      pathElements: merkleProof.pathElements,
      pathIndices: merkleProof.pathIndices,
      leafIndex,
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

function normalizeToFieldElement(value) {
  let v = BigInt(value) % FIELD_SIZE;
  if (v < 0n) v += FIELD_SIZE;
  return v;
}

function parseSecretToBigInt(secret) {
  if (typeof secret === 'bigint') return secret;
  const s = String(secret);
  const hexMatch = s.match(/^(0x)?[0-9a-fA-F]+$/);
  if (hexMatch) {
    const hex = s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
    if (hex.length === 0) return 0n;
    return BigInt(`0x${hex}`);
  }
  const secretBuff = new TextEncoder().encode(s);
  return ffjavascript.utils.leBuff2int(secretBuff);
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
