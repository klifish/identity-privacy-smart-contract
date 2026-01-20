/**
 * Contract Addresses Management Module
 *
 * Manages deployed contract addresses for different networks
 * @module contracts
 */

const fs = require('fs');
const path = require('path');

/**
 * Default contract addresses for Polygon Amoy testnet
 */
const POLYGON_AMOY_ADDRESSES = {
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EIP-4337 v0.7 EntryPoint
};

/**
 * Contract addresses manager
 */
class ContractAddresses {
  /**
   * Create a ContractAddresses manager
   * @param {Object} config - Configuration
   * @param {string} config.deployedContractsPath - Path to deployedContracts.json
   * @param {Object} config.addresses - Manual addresses override
   */
  constructor(config = {}) {
    this.deployedContractsPath =
      config.deployedContractsPath ||
      path.join(__dirname, '..', 'scripts', 'deploy', 'deployedContracts.json');
    this.addresses = config.addresses || {};
    this._cache = null;
  }

  /**
   * Load deployed contracts from file
   * @returns {Object} - Deployed contracts
   */
  _loadDeployedContracts() {
    if (this._cache) return this._cache;

    try {
      if (fs.existsSync(this.deployedContractsPath)) {
        this._cache = JSON.parse(fs.readFileSync(this.deployedContractsPath, 'utf8'));
      } else {
        this._cache = {};
      }
    } catch (error) {
      this._cache = {};
    }

    return this._cache;
  }

  /**
   * Get a contract address
   * @param {string} contractName - Contract name
   * @returns {string|null} - Address or null
   */
  get(contractName) {
    // First check manual override
    if (this.addresses[contractName]) {
      return this.addresses[contractName];
    }

    // Then check deployed contracts file
    const deployed = this._loadDeployedContracts();
    return deployed[contractName] || null;
  }

  /**
   * Get Hasher contract address
   * @returns {string|null}
   */
  getHasher() {
    return this.get('Hasher');
  }

  /**
   * Get MerkleRegistry contract address
   * @returns {string|null}
   */
  getRegistry() {
    return this.get('Registry');
  }

  /**
   * Get RegisterVerifier contract address
   * @returns {string|null}
   */
  getRegisterVerifier() {
    return this.get('RegisterVerifier');
  }

  /**
   * Get CommitmentVerifier contract address
   * @returns {string|null}
   */
  getCommitmentVerifier() {
    return this.get('CommitmentVerifier');
  }

  /**
   * Get RunnerFactory contract address
   * @returns {string|null}
   */
  getRunnerFactory() {
    return this.get('RunnerFactory');
  }

  /**
   * Get AccountFactory contract address
   * @returns {string|null}
   */
  getAccountFactory() {
    return this.get('AccountFactory');
  }

  /**
   * Get VerifyingPaymaster contract address
   * @returns {string|null}
   */
  getVerifyingPaymaster() {
    return this.get('VerifyingPaymaster');
  }

  /**
   * Get first Runner address (from array)
   * @returns {string|null}
   */
  getFirstRunner() {
    const deployed = this._loadDeployedContracts();
    if (Array.isArray(deployed.Runner) && deployed.Runner.length > 0) {
      return deployed.Runner[0];
    }
    return null;
  }

  /**
   * Get all Runner addresses
   * @returns {Array<string>}
   */
  getAllRunners() {
    const deployed = this._loadDeployedContracts();
    if (Array.isArray(deployed.Runner)) {
      return deployed.Runner;
    }
    return [];
  }

  /**
   * Get EntryPoint address (EIP-4337)
   * @returns {string}
   */
  getEntryPoint() {
    return this.get('EntryPoint') || POLYGON_AMOY_ADDRESSES.entryPoint;
  }

  /**
   * Set a contract address (runtime override)
   * @param {string} contractName - Contract name
   * @param {string} address - Contract address
   */
  set(contractName, address) {
    this.addresses[contractName] = address;
  }

  /**
   * Get all addresses
   * @returns {Object} - All addresses
   */
  getAll() {
    const deployed = this._loadDeployedContracts();
    return { ...deployed, ...this.addresses };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this._cache = null;
  }
}

/**
 * Contract ABIs (minimal interfaces)
 */
const ABIs = {
  MyAccountFactory: [
    'function createAccount(uint256 commitment, uint256 salt) external returns (address)',
    'function getSender(uint256 commitment, uint256 salt) external view returns (address)',
  ],

  MyAccount: [
    'function execute(address dest, uint256 value, bytes calldata func) external',
    'function validateUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256)',
    'function getNonce() external view returns (uint256)',
    'function preVerifySignature(bytes calldata signature, bytes32 userOpHash) external',
    'event ContractDeployed(address indexed contractAddress)',
  ],

  MerkleRegistry: [
    'function registerUser(uint256 leaf) external',
    'function isKnownRoot(uint256 root) external view returns (bool)',
    'function getLastRoot() external view returns (uint256)',
    'event UserRegistered(uint256 leaf, uint32 index)',
  ],

  Runner: [
    'function execute(address dest, uint256 value, bytes calldata func) external',
    'function getNonce() external view returns (uint256)',
    'function preVerifySignature(bytes calldata signature, bytes32 userOpHash) external',
    'event ContractDeployed(address indexed contractAddress)',
  ],

  VerifyingPaymaster: [
    'function getHash(tuple(address sender, uint256 nonce, bytes callData, bytes32 accountGasLimits, bytes initCode, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, uint48 validUntil, uint48 validAfter) external view returns (bytes32)',
    'function deposit() external payable',
    'function getDeposit() external view returns (uint256)',
  ],

  UserData: [
    'function update(string calldata newData, bytes calldata proof) external',
    'function getData() external view returns (string memory)',
    'function getCommitment() external view returns (uint256)',
  ],

  EntryPoint: [
    'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] calldata ops, address payable beneficiary) external',
    'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
    'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
  ],
};

/**
 * Create ContractAddresses instance with custom config
 * @param {Object} config - Configuration
 * @returns {ContractAddresses}
 */
function createContractAddresses(config) {
  return new ContractAddresses(config);
}

module.exports = {
  ContractAddresses,
  createContractAddresses,
  ABIs,
  POLYGON_AMOY_ADDRESSES,
};
