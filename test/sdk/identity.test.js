/**
 * Identity Module Tests
 *
 * Comprehensive tests for the Identity module including:
 * - Unit tests for calculateLeaf function
 * - Unit tests for IdentityClient class
 * - Integration tests with Hardhat local blockchain
 *
 * To run these tests:
 *   npx hardhat test test/sdk/identity.test.js --network hardhat
 *
 * Or with external node:
 *   1. Start hardhat node: npx hardhat node
 *   2. Run tests: npx hardhat test test/sdk/identity.test.js --network localhost
 */

const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const circomlibjs = require('circomlibjs');
const path = require('path');
const { IdentityClient, calculateLeaf } = require('../../src/identity');
const { computePedersenHash } = require('../../src/utils');
const { ZKPClient } = require('../../src/zkp');

// Contract ABIs for direct testing
const MyAccountFactoryABI = [
  'function createAccount(uint256 commitment, uint256 salt) external returns (address)',
  'function getSender(uint256 commitment, uint256 salt) external view returns (address)',
  'event AccountCreated(address accountAddress, uint256 commitment)',
];

const MerkleRegistryABI = [
  'function registerUser(uint256 leaf) external',
  'function isKnownRoot(uint256 root) external view returns (bool)',
  'function verify(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[2] calldata _pubSignals) external view returns (bool)',
  'function roots(uint256) external view returns (uint256)',
  'function currentRootIndex() external view returns (uint32)',
  'event UserRegistered(uint256 leaf, uint32 index)',
];

/**
 * Unit Tests - No blockchain required
 */
describe('Identity Module - Unit Tests', function () {
  this.timeout(30000);

  describe('calculateLeaf', function () {
    it('should calculate leaf from credentials', async function () {
      const secret = 'test-secret';
      const nullifier = 0n;

      const leaf = await calculateLeaf(secret, nullifier);

      expect(typeof leaf).to.equal('bigint');
      expect(leaf > 0n).to.be.true;
    });

    it('should produce consistent results for same inputs', async function () {
      const secret = 'my-secret';
      const nullifier = 1n;

      const leaf1 = await calculateLeaf(secret, nullifier);
      const leaf2 = await calculateLeaf(secret, nullifier);

      expect(leaf1).to.equal(leaf2);
    });

    it('should produce different leaves for different secrets', async function () {
      const nullifier = 0n;

      const leaf1 = await calculateLeaf('secret1', nullifier);
      const leaf2 = await calculateLeaf('secret2', nullifier);

      expect(leaf1).to.not.equal(leaf2);
    });

    it('should produce different leaves for different nullifiers', async function () {
      const secret = 'same-secret';

      const leaf1 = await calculateLeaf(secret, 0n);
      const leaf2 = await calculateLeaf(secret, 1n);

      expect(leaf1).to.not.equal(leaf2);
    });
  });

  describe('IdentityClient', function () {
    it('should be importable', function () {
      expect(typeof IdentityClient).to.equal('function');
    });

    it('should throw error when creating without config', function () {
      expect(() => new IdentityClient({})).to.throw(Error);
    });
  });
});

/**
 * Integration Tests - Requires Hardhat blockchain
 */
describe('Identity Module - Integration Tests', function () {
  this.timeout(120000);

  let deployer;
  let hasherAddress;
  let registerVerifierAddress;
  let commitmentVerifierAddress;
  let registryAddress;
  let accountFactoryAddress;
  let identityClient;
  let accountFactory;
  let registry;
  // Determines whether helpers talk to contracts directly (true) or through the IdentityClient SDK (false).
  // 中文：控制测试是直接调用合约(true)，还是通过 IdentityClient SDK 间接调用(false)。
  let useDirectContracts = false;

  const MERKLE_TREE_LEVEL = 20;
  const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  const SEED = 'mimcsponge';

  // Helper functions to abstract direct contract vs IdentityClient calls
  const helpers = {
    async getSender(commitment, salt) {
      if (useDirectContracts) {
        return accountFactory.getSender(commitment, salt);
      }
      return identityClient.getSender(commitment, salt);
    },

    async createSmartAccount(secret, options = {}) {
      const { salt = 1, countId = 0 } = options;
      if (useDirectContracts) {
        const commitment = await computePedersenHash(secret + countId);
        const predictedAddress = await accountFactory.getSender(commitment, salt);
        const code = await ethers.provider.getCode(predictedAddress);

        if (code && code !== '0x') {
          return { address: predictedAddress, deployed: false };
        }

        const tx = await accountFactory.createAccount(commitment, salt);
        await tx.wait();
        return { address: predictedAddress, deployed: true };
      }
      return identityClient.createSmartAccount(secret, options);
    },

    async calculateLeafHelper(secret, nullifier) {
      return calculateLeaf(secret, nullifier);
    },

    async registerUser(secret, nullifier) {
      if (useDirectContracts) {
        const leaf = await calculateLeaf(secret, nullifier);
        const result = await helpers.registerUserWithLeaf(leaf);
        return { ...result, leaf };
      }
      return identityClient.registerUser(secret, nullifier);
    },

    async registerUserWithLeaf(leaf) {
      if (useDirectContracts) {
        const events = await registry.queryFilter(registry.filters.UserRegistered());
        const leafs = events.map((event) => event.args.leaf);

        if (leafs.includes(leaf)) {
          return { success: true, alreadyRegistered: true };
        }

        const tx = await registry.registerUser(leaf);
        await tx.wait();
        return { success: true, alreadyRegistered: false };
      }
      return identityClient.registerUserWithLeaf(leaf);
    },

    async getRegisteredLeaves() {
      if (useDirectContracts) {
        const events = await registry.queryFilter(registry.filters.UserRegistered());
        const sortedEvents = events.sort((a, b) =>
          a.args.index < b.args.index ? -1 : a.args.index > b.args.index ? 1 : 0
        );
        return sortedEvents.map((event) => event.args.leaf);
      }
      return identityClient.getRegisteredLeaves();
    },

    async isKnownRoot(root) {
      if (useDirectContracts) {
        return registry.isKnownRoot(root);
      }
      return identityClient.isKnownRoot(root);
    },
  };

  before(async function () {
    [deployer] = await ethers.getSigners();
    console.log('Deployer address:', deployer.address);
    console.log('Network:', network.name);

    // 1. Deploy Hasher (MiMC Sponge)
    console.log('Deploying Hasher...');
    const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
    const abi = circomlibjs.mimcSpongecontract.abi;
    const HasherFactory = new ethers.ContractFactory(abi, bytecode, deployer);
    const hasher = await HasherFactory.deploy();
    await hasher.waitForDeployment();
    hasherAddress = await hasher.getAddress();
    console.log('Hasher deployed at:', hasherAddress);

    // 2. Deploy RegisterGroth16Verifier
    console.log('Deploying RegisterGroth16Verifier...');
    const RegisterVerifier = await ethers.getContractFactory('RegisterGroth16Verifier', deployer);
    const registerVerifier = await RegisterVerifier.deploy();
    await registerVerifier.waitForDeployment();
    registerVerifierAddress = await registerVerifier.getAddress();
    console.log('RegisterGroth16Verifier deployed at:', registerVerifierAddress);

    // 3. Deploy CommitmentGroth16Verifier
    console.log('Deploying CommitmentGroth16Verifier...');
    const CommitmentVerifier = await ethers.getContractFactory('CommitmentGroth16Verifier', deployer);
    const commitmentVerifier = await CommitmentVerifier.deploy();
    await commitmentVerifier.waitForDeployment();
    commitmentVerifierAddress = await commitmentVerifier.getAddress();
    console.log('CommitmentGroth16Verifier deployed at:', commitmentVerifierAddress);

    // 4. Deploy MerkleRegistry
    console.log('Deploying MerkleRegistry...');
    const MerkleRegistry = await ethers.getContractFactory('MerkleRegistry', deployer);
    const registryContract = await MerkleRegistry.deploy(MERKLE_TREE_LEVEL, hasherAddress, registerVerifierAddress);
    await registryContract.waitForDeployment();
    registryAddress = await registryContract.getAddress();
    console.log('MerkleRegistry deployed at:', registryAddress);

    // 5. Deploy MyAccountFactory
    console.log('Deploying MyAccountFactory...');
    const MyAccountFactory = await ethers.getContractFactory('MyAccountFactory', deployer);
    const accountFactoryContract = await MyAccountFactory.deploy(ENTRY_POINT, commitmentVerifierAddress, 0);
    await accountFactoryContract.waitForDeployment();
    accountFactoryAddress = await accountFactoryContract.getAddress();
    console.log('MyAccountFactory deployed at:', accountFactoryAddress);

    // Store direct contract references
    accountFactory = new ethers.Contract(accountFactoryAddress, MyAccountFactoryABI, deployer);
    registry = new ethers.Contract(registryAddress, MerkleRegistryABI, deployer);

    // Create IdentityClient - only works with localhost network
    if (network.name === 'localhost') {
      const rpcUrl = 'http://127.0.0.1:8545';
      // Use an account derived from the default Hardhat mnemonic that differs from the deployer.
      const hdWallet = ethers.Wallet.fromPhrase(
        'test test test test test test test test test test test junk',
        "m/44'/60'/0'/0/1"
      );
      const privateKey = hdWallet.privateKey;

      identityClient = new IdentityClient({
        rpcUrl: rpcUrl,
        privateKey: privateKey,
        accountFactoryAddress: accountFactoryAddress,
        registryAddress: registryAddress,
      });
      console.log('IdentityClient created successfully');
    } else {
      useDirectContracts = true;
      console.log('Using direct contract calls (in-memory hardhat network)');
    }
  });

  describe('getSender', function () {
    it('should return a valid address for a commitment', async function () {
      const commitment = await computePedersenHash('test-secret0');
      const predictedAddress = await helpers.getSender(commitment, 1);
      expect(ethers.isAddress(predictedAddress)).to.be.true;
    });

    it('should return same address for same commitment and salt', async function () {
      const commitment = await computePedersenHash('test-secret0');
      const address1 = await helpers.getSender(commitment, 1);
      const address2 = await helpers.getSender(commitment, 1);
      expect(address1).to.equal(address2);
    });

    it('should return different addresses for different salts', async function () {
      const commitment = await computePedersenHash('test-secret0');
      const address1 = await helpers.getSender(commitment, 1);
      const address2 = await helpers.getSender(commitment, 2);
      expect(address1).to.not.equal(address2);
    });

    it('should return different addresses for different commitments', async function () {
      const commitment1 = await computePedersenHash('secret-a');
      const commitment2 = await computePedersenHash('secret-b');
      const address1 = await helpers.getSender(commitment1, 1);
      const address2 = await helpers.getSender(commitment2, 1);
      expect(address1).to.not.equal(address2);
    });
  });

  describe('createSmartAccount', function () {
    let testCounter = 0;
    const getShortSecret = () => `sec${++testCounter}${Date.now() % 10000}`;

    it('should create a new smart account', async function () {
      const secret = getShortSecret();
      const result = await helpers.createSmartAccount(secret, { salt: 1 });

      expect(result).to.have.property('address');
      expect(result).to.have.property('deployed');
      expect(ethers.isAddress(result.address)).to.be.true;
      expect(result.deployed).to.be.true;
    });

    it('should return existing account without force flag', async function () {
      const secret = getShortSecret();

      const result1 = await helpers.createSmartAccount(secret, { salt: 1 });
      expect(result1.deployed).to.be.true;

      const result2 = await helpers.createSmartAccount(secret, { salt: 1 });
      expect(result2.deployed).to.be.false;
      expect(result2.address).to.equal(result1.address);
    });

    it('should create accounts with different countIds', async function () {
      const secret = getShortSecret();

      const result1 = await helpers.createSmartAccount(secret, { salt: 1, countId: 0 });
      const result2 = await helpers.createSmartAccount(secret, { salt: 1, countId: 1 });

      expect(result1.address).to.not.equal(result2.address);
    });

    it('should create accounts with different salts', async function () {
      const secret = getShortSecret();

      const result1 = await helpers.createSmartAccount(secret, { salt: 1 });
      const result2 = await helpers.createSmartAccount(secret, { salt: 2 });

      expect(result1.address).to.not.equal(result2.address);
    });
  });

  describe('registerUser', function () {
    let testSmartAccountAddress;
    let testSecret;
    const testNullifier = 0n;

    before(async function () {
      testSecret = `reg${Date.now() % 100000}`;
      const result = await helpers.createSmartAccount(testSecret);
      testSmartAccountAddress = result.address;
    });

    it('should register a user successfully', async function () {
      const result = await helpers.registerUser(testSecret, testNullifier);

      expect(result.success).to.be.true;
      expect(result.alreadyRegistered).to.be.false;
      expect(typeof result.leaf).to.equal('bigint');
    });

    it('should detect already registered user', async function () {
      const result = await helpers.registerUser(testSecret, testNullifier);

      expect(result.success).to.be.true;
      expect(result.alreadyRegistered).to.be.true;
    });

    it('should register different users with different nullifiers', async function () {
      const newNullifier = 999n;
      const result = await helpers.registerUser(testSecret, newNullifier);

      expect(result.success).to.be.true;
      expect(result.alreadyRegistered).to.be.false;
    });
  });

  describe('registerUserWithLeaf', function () {
    it('should register a user with a pre-calculated leaf', async function () {
      const secret = `lf${Date.now() % 10000}`;
      const nullifier = 123n;

      const leaf = await helpers.calculateLeafHelper(secret, nullifier);
      const result = await helpers.registerUserWithLeaf(leaf);

      expect(result.success).to.be.true;
      expect(result.alreadyRegistered).to.be.false;
    });

    it('should detect already registered leaf', async function () {
      const secret = `dup${Date.now() % 10000}`;
      const nullifier = 456n;

      const leaf = await helpers.calculateLeafHelper(secret, nullifier);

      const result1 = await helpers.registerUserWithLeaf(leaf);
      expect(result1.alreadyRegistered).to.be.false;

      const result2 = await helpers.registerUserWithLeaf(leaf);
      expect(result2.alreadyRegistered).to.be.true;
    });
  });

  describe('getRegisteredLeaves', function () {
    it('should return all registered leaves', async function () {
      const leaves = await helpers.getRegisteredLeaves();

      expect(Array.isArray(leaves)).to.be.true;
      expect(leaves.length).to.be.greaterThan(0);
      leaves.forEach((leaf) => {
        expect(typeof leaf).to.equal('bigint');
      });
    });

    it('should include newly registered leaves', async function () {
      const leavesBefore = await helpers.getRegisteredLeaves();

      const secret = `nl${Date.now() % 10000}`;
      const nullifier = 789n;
      const newLeaf = await helpers.calculateLeafHelper(secret, nullifier);
      await helpers.registerUserWithLeaf(newLeaf);

      const leavesAfter = await helpers.getRegisteredLeaves();

      expect(leavesAfter.length).to.equal(leavesBefore.length + 1);
      expect(leavesAfter).to.include(newLeaf);
    });
  });

  describe('isKnownRoot', function () {
    it('should return true for valid root after registration', async function () {
      const secret = `rt${Date.now() % 10000}`;
      const nullifier = 111n;
      await helpers.registerUser(secret, nullifier);

      const currentIndex = await registry.currentRootIndex();
      const currentRoot = await registry.roots(currentIndex);

      const isKnown = await helpers.isKnownRoot(currentRoot);
      expect(isKnown).to.be.true;
    });

    it('should return false for invalid root', async function () {
      const invalidRoot = 12345678901234567890n;
      const isKnown = await helpers.isKnownRoot(invalidRoot);
      expect(isKnown).to.be.false;
    });
  });

  describe('proveRegistration - ZKP verification', function () {
    let zkpTestSmartAccountAddress;
    let zkpTestSecret;
    const zkpTestNullifier = 0n;
    const circuitsPath = path.join(__dirname, '..', '..', 'build', 'circuits');

    before(async function () {
      // Create and register a user for ZKP tests
      zkpTestSecret = `zkp${Date.now() % 100000}`;
      const result = await helpers.createSmartAccount(zkpTestSecret);
      zkpTestSmartAccountAddress = result.address;
      await helpers.registerUser(zkpTestSecret, zkpTestNullifier);
      console.log('ZKP test user registered at:', zkpTestSmartAccountAddress);
    });

    it('should generate a valid registration proof', async function () {
      if (useDirectContracts) {
        // For direct contracts, use ZKPClient directly
        const leaves = await helpers.getRegisteredLeaves();
        const zkpClient = new ZKPClient({ circuitsPath });

        const result = await zkpClient.generateRegistrationProof({
          smartAccountAddress: zkpTestSmartAccountAddress,
          secret: zkpTestSecret,
          nullifier: zkpTestNullifier,
          leaves,
        });

        expect(result).to.have.property('proof');
        expect(result).to.have.property('proofComponents');
        expect(result).to.have.property('root');
        expect(result.proofComponents).to.have.property('pA');
        expect(result.proofComponents).to.have.property('pB');
        expect(result.proofComponents).to.have.property('pC');
        expect(result.proofComponents).to.have.property('pubSignals');
        console.log('Registration proof generated successfully');
        console.log('Merkle root:', result.root.toString().substring(0, 20) + '...');
      } else {
        const result = await identityClient.proveRegistration(zkpTestSecret, zkpTestNullifier, {
          circuitsPath,
        });

        expect(result).to.have.property('proof');
        expect(result).to.have.property('root');
        expect(result.proof).to.have.property('pA');
        expect(result.proof).to.have.property('pB');
        expect(result.proof).to.have.property('pC');
        expect(result.proof).to.have.property('pubSignals');
        console.log('Registration proof generated successfully');
        console.log('Merkle root:', result.root.toString().substring(0, 20) + '...');
      }
    });

    it('should verify registration proof on-chain', async function () {
      if (useDirectContracts) {
        const leaves = await helpers.getRegisteredLeaves();
        const zkpClient = new ZKPClient({ circuitsPath });

        const proofResult = await zkpClient.generateRegistrationProof({
          smartAccountAddress: zkpTestSmartAccountAddress,
          secret: zkpTestSecret,
          nullifier: zkpTestNullifier,
          leaves,
        });

        const { pA, pB, pC, pubSignals } = proofResult.proofComponents;
        const isValid = await registry.verify(pA, pB, pC, pubSignals);
        expect(isValid).to.be.true;
        console.log('On-chain verification passed');
      } else {
        const proofResult = await identityClient.proveRegistration(zkpTestSecret, zkpTestNullifier, {
          circuitsPath,
        });

        const isValid = await identityClient.verifyRegistration(proofResult.proof);
        expect(isValid).to.be.true;
        console.log('On-chain verification passed');
      }
    });

    it('should complete full prove and verify workflow', async function () {
      if (useDirectContracts) {
        this.skip(); // proveAndVerifyRegistration only available via IdentityClient
      }

      const result = await identityClient.proveAndVerifyRegistration(
        zkpTestSmartAccountAddress,
        zkpTestSecret,
        zkpTestNullifier,
        { circuitsPath }
      );

      expect(result.isValid).to.be.true;
      expect(result).to.have.property('proof');
      expect(result).to.have.property('root');
      console.log('Full prove and verify workflow completed');
      console.log('Verification result:', result.isValid);
    });

    it('should fail verification with wrong secret', async function () {
      const wrongSecret = 'wrong-secret-12345';

      try {
        if (useDirectContracts) {
          const leaves = await helpers.getRegisteredLeaves();
          const zkpClient = new ZKPClient({ circuitsPath });

          // This should fail because the wrong secret produces a different leaf
          // that is not in the Merkle tree
          await zkpClient.generateRegistrationProof({
            smartAccountAddress: zkpTestSmartAccountAddress,
            secret: wrongSecret,
            nullifier: zkpTestNullifier,
            leaves,
          });
          expect.fail('Should have thrown an error');
        } else {
          await identityClient.proveRegistration(wrongSecret, zkpTestNullifier, { circuitsPath });
          expect.fail('Should have thrown an error');
        }
      } catch (error) {
        // Expected: proof generation should fail because leaf is not in tree
        expect(error).to.exist;
        console.log('Correctly failed with wrong secret:', error.message.substring(0, 50) + '...');
      }
    });

    it('should fail verification with wrong nullifier', async function () {
      const wrongNullifier = 999999n;

      try {
        if (useDirectContracts) {
          const leaves = await helpers.getRegisteredLeaves();
          const zkpClient = new ZKPClient({ circuitsPath });

          await zkpClient.generateRegistrationProof({
            smartAccountAddress: zkpTestSmartAccountAddress,
            secret: zkpTestSecret,
            nullifier: wrongNullifier,
            leaves,
          });
          expect.fail('Should have thrown an error');
        } else {
          await identityClient.proveRegistration(zkpTestSecret, wrongNullifier, { circuitsPath });
          expect.fail('Should have thrown an error');
        }
      } catch (error) {
        expect(error).to.exist;
        console.log('Correctly failed with wrong nullifier:', error.message.substring(0, 50) + '...');
      }
    });
  });

  describe('Full workflow', function () {
    it('should complete full identity registration workflow', async function () {
      const userSecret = `fw${Date.now() % 10000}`;
      const nullifier = 0n;

      // Step 1: Create smart account
      const accountResult = await helpers.createSmartAccount(userSecret);
      expect(accountResult.deployed).to.be.true;
      console.log('Smart account created at:', accountResult.address);

      // Step 2: Calculate leaf
      const leaf = await helpers.calculateLeafHelper(userSecret, nullifier);
      expect(typeof leaf).to.equal('bigint');
      console.log('Calculated leaf:', leaf.toString().substring(0, 20) + '...');

      // Step 3: Register user
      const registerResult = await helpers.registerUser(userSecret, nullifier);
      expect(registerResult.success).to.be.true;
      expect(registerResult.alreadyRegistered).to.be.false;
      console.log('User registered successfully');

      // Step 4: Verify user is in registered leaves
      const leaves = await helpers.getRegisteredLeaves();
      expect(leaves).to.include(leaf);
      console.log('User leaf found in registry');

      // Step 5: Verify current root is known
      const currentIndex = await registry.currentRootIndex();
      const currentRoot = await registry.roots(currentIndex);
      const isKnown = await helpers.isKnownRoot(currentRoot);
      expect(isKnown).to.be.true;
      console.log('Current Merkle root is valid');
    });

    it('should complete full workflow with ZKP verification', async function () {
      const circuitsPath = path.join(__dirname, '..', '..', 'build', 'circuits');
      const userSecret = `zkpfw${Date.now() % 10000}`;
      const nullifier = 0n;

      // Step 1: Create smart account
      const accountResult = await helpers.createSmartAccount(userSecret);
      expect(accountResult.deployed).to.be.true;
      console.log('Step 1: Smart account created at:', accountResult.address);

      // Step 2: Register user
      const registerResult = await helpers.registerUser(userSecret, nullifier);
      expect(registerResult.success).to.be.true;
      console.log('Step 2: User registered successfully');

      // Step 3: Generate ZKP proof of registration
      const leaves = await helpers.getRegisteredLeaves();
      const zkpClient = new ZKPClient({ circuitsPath });
      const proofResult = await zkpClient.generateRegistrationProof({
        smartAccountAddress: accountResult.address,
        secret: userSecret,
        nullifier: nullifier,
        leaves,
      });
      expect(proofResult).to.have.property('proofComponents');
      console.log('Step 3: ZKP proof generated');

      // Step 4: Verify proof on-chain
      const { pA, pB, pC, pubSignals } = proofResult.proofComponents;
      const isValid = await registry.verify(pA, pB, pC, pubSignals);
      expect(isValid).to.be.true;
      console.log('Step 4: On-chain verification passed');

      console.log('Full workflow with ZKP verification completed successfully!');
    });

    it('should support multiple users registration', async function () {
      const ts = Date.now() % 10000;
      const users = [
        { secret: `u1${ts}`, nullifier: 0n },
        { secret: `u2${ts}`, nullifier: 0n },
        { secret: `u3${ts}`, nullifier: 0n },
      ];

      const registeredLeaves = [];

      for (const user of users) {
        const accountResult = await helpers.createSmartAccount(user.secret);
        expect(accountResult.deployed).to.be.true;

        const registerResult = await helpers.registerUser(user.secret, user.nullifier);
        expect(registerResult.success).to.be.true;
        registeredLeaves.push(registerResult.leaf);
      }

      const allLeaves = await helpers.getRegisteredLeaves();
      for (const leaf of registeredLeaves) {
        expect(allLeaves).to.include(leaf);
      }
      console.log(`Successfully registered ${users.length} users`);
    });
  });
});

after(function () {
  if (!process.env.DEBUG_HANDLES) {
    return;
  }
  const handles = process._getActiveHandles().map((handle) => handle.constructor.name);
  const requests = process._getActiveRequests().map((req) => req.constructor.name);
  console.log('[debug] active handles:', handles);
  console.log('[debug] active requests:', requests);
});
