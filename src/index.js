/**
 * Identity Privacy SDK
 *
 * A SDK for privacy-preserving identity management on blockchain
 * using Zero-Knowledge Proofs and EIP-4337 Account Abstraction.
 *
 * @module identity-privacy-sdk
 */

const identity = require('./identity');
const userOp = require('./userOp');
const zkp = require('./zkp');
const contracts = require('./contracts');
const utils = require('./utils');

module.exports = {
  // Identity management
  identity,

  // UserOperation handling (EIP-4337)
  userOp,

  // Zero-Knowledge Proof utilities
  zkp,

  // Contract addresses management
  contracts,

  // Utility functions
  utils,

  // Re-export commonly used functions for convenience
  createSmartAccount: identity.createSmartAccount,
  registerUser: identity.registerUser,
  generateProof: zkp.generateRegistrationProof,
  getUserOpHash: userOp.getUserOpHash,
  packUserOp: userOp.packUserOp,
};
