/**
 * Identity Management Module
 *
 * Handles smart account creation and user registration
 * @module identity
 */

const { ethers } = require('ethers');
const circomlibjs = require('circomlibjs');
const ffjavascript = require('ffjavascript');
const { pedersenHashMultipleInputs, computePedersenHash } = require('./utils');

// Contract ABIs (minimal interfaces)
const MyAccountFactoryABI = [
  'function createAccount(uint256 commitment, uint256 salt) external returns (address)',
  'function getSender(uint256 commitment, uint256 salt) external view returns (address)',
];

const MerkleRegistryABI = [
  'function registerUser(uint256 leaf) external',
  'function isKnownRoot(uint256 root) external view returns (bool)',
  'event UserRegistered(uint256 indexed index, uint256 leaf)',
];

/**
 * Identity client for managing smart accounts and user registration
 */
class IdentityClient {
  /**
   * Create an IdentityClient instance
   * @param {Object} config - Configuration object
   * @param {string} config.rpcUrl - RPC endpoint URL
   * @param {string} config.privateKey - Admin/signer private key
   * @param {string} config.accountFactoryAddress - MyAccountFactory contract address
   * @param {string} config.registryAddress - MerkleRegistry contract address
   */
  constructor(config) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.accountFactoryAddress = config.accountFactoryAddress;
    this.registryAddress = config.registryAddress;

    // Initialize contracts
    this.accountFactory = new ethers.Contract(
      this.accountFactoryAddress,
      MyAccountFactoryABI,
      this.signer
    );
    this.registry = new ethers.Contract(this.registryAddress, MerkleRegistryABI, this.signer);
  }

  /**
   * Calculate Merkle tree leaf from user credentials
   * @param {string} smartAccountAddress - Smart account address
   * @param {string} secret - User secret
   * @param {bigint} nullifier - Nullifier value
   * @returns {Promise<bigint>} - Leaf value
   */
  async calculateLeaf(smartAccountAddress, secret, nullifier) {
    const secretBuff = new TextEncoder().encode(secret);
    const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff);

    const src = [smartAccountAddress, secretBigInt, nullifier];
    const srcHash = await pedersenHashMultipleInputs(src);

    const babyjub = await circomlibjs.buildBabyjub();
    const hP = babyjub.unpackPoint(srcHash);
    const leaf = babyjub.F.toObject(hP[1]);

    return leaf;
  }

  /**
   * Get predicted smart account address
   * @param {bigint|string} commitment - Commitment hash
   * @param {number} salt - Salt value (default: 1)
   * @returns {Promise<string>} - Predicted address
   */
  async getSender(commitment, salt = 1) {
    return this.accountFactory.getSender(commitment, salt);
  }

  /**
   * Create a new smart account
   * @param {string} secret - User secret for commitment
   * @param {Object} options - Options
   * @param {number} options.salt - Salt value (default: 1)
   * @param {boolean} options.force - Force creation even if exists (default: false)
   * @param {number} options.countId - Counter ID for commitment (default: 0)
   * @returns {Promise<{address: string, deployed: boolean}>} - Result
   */
  async createSmartAccount(secret, options = {}) {
    const { salt = 1, force = false, countId = 0 } = options;

    const commitment = await computePedersenHash(secret + countId);
    const predictedAddress = await this.accountFactory.getSender(commitment, salt);
    const code = await this.provider.getCode(predictedAddress);

    if (!force && code && code !== '0x') {
      return { address: predictedAddress, deployed: false };
    }

    const tx = await this.accountFactory.createAccount(commitment, salt);
    await tx.wait();

    return { address: predictedAddress, deployed: true };
  }

  /**
   * Register user to Merkle tree with leaf value
   * @param {bigint} leaf - Leaf value to insert
   * @returns {Promise<{success: boolean, alreadyRegistered: boolean}>}
   */
  async registerUserWithLeaf(leaf) {
    // Check if already registered
    const events = await this.registry.queryFilter(this.registry.filters.UserRegistered());
    const leafs = events.map((event) => event.args.leaf);

    if (leafs.includes(leaf)) {
      return { success: true, alreadyRegistered: true };
    }

    const tx = await this.registry.registerUser(leaf);
    await tx.wait();

    return { success: true, alreadyRegistered: false };
  }

  /**
   * Register user to Merkle tree
   * @param {string} smartAccountAddress - Smart account address
   * @param {string} secret - User secret
   * @param {bigint} nullifier - Nullifier value
   * @returns {Promise<{success: boolean, leaf: bigint, alreadyRegistered: boolean}>}
   */
  async registerUser(smartAccountAddress, secret, nullifier) {
    const leaf = await this.calculateLeaf(smartAccountAddress, secret, nullifier);
    const result = await this.registerUserWithLeaf(leaf);
    return { ...result, leaf };
  }

  /**
   * Check if a root is known in the registry
   * @param {bigint} root - Merkle root to check
   * @returns {Promise<boolean>}
   */
  async isKnownRoot(root) {
    return this.registry.isKnownRoot(root);
  }

  /**
   * Get all registered leaves from the registry
   * @returns {Promise<Array<bigint>>}
   */
  async getRegisteredLeaves() {
    const events = await this.registry.queryFilter(this.registry.filters.UserRegistered());
    const sortedEvents = events.sort((a, b) =>
      a.args.index < b.args.index ? -1 : a.args.index > b.args.index ? 1 : 0
    );
    return sortedEvents.map((event) => event.args.leaf);
  }
}

/**
 * Create smart account (standalone function)
 * @param {Object} config - Configuration
 * @param {string} secret - User secret
 * @param {Object} options - Options
 * @returns {Promise<{address: string, deployed: boolean}>}
 */
async function createSmartAccount(config, secret, options = {}) {
  const client = new IdentityClient(config);
  return client.createSmartAccount(secret, options);
}

/**
 * Register user (standalone function)
 * @param {Object} config - Configuration
 * @param {string} smartAccountAddress - Smart account address
 * @param {string} secret - User secret
 * @param {bigint} nullifier - Nullifier
 * @returns {Promise<Object>}
 */
async function registerUser(config, smartAccountAddress, secret, nullifier) {
  const client = new IdentityClient(config);
  return client.registerUser(smartAccountAddress, secret, nullifier);
}

/**
 * Calculate leaf (standalone function)
 * @param {string} smartAccountAddress - Smart account address
 * @param {string} secret - User secret
 * @param {bigint} nullifier - Nullifier
 * @returns {Promise<bigint>}
 */
async function calculateLeaf(smartAccountAddress, secret, nullifier) {
  const secretBuff = new TextEncoder().encode(secret);
  const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff);

  const src = [smartAccountAddress, secretBigInt, nullifier];
  const srcHash = await pedersenHashMultipleInputs(src);

  const babyjub = await circomlibjs.buildBabyjub();
  const hP = babyjub.unpackPoint(srcHash);
  return babyjub.F.toObject(hP[1]);
}

module.exports = {
  IdentityClient,
  createSmartAccount,
  registerUser,
  calculateLeaf,
};
