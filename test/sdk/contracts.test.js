/**
 * Contracts Module Tests
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  ContractAddresses,
  createContractAddresses,
  ABIs,
  POLYGON_AMOY_ADDRESSES,
} = require('../../src/contracts');

describe('Contracts Module', function () {
  const testDeployedPath = path.join(__dirname, 'test-deployed.json');

  // Setup test file
  before(function () {
    const testData = {
      Hasher: '0x1111111111111111111111111111111111111111',
      Registry: '0x2222222222222222222222222222222222222222',
      AccountFactory: '0x3333333333333333333333333333333333333333',
      Runner: [
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
      ],
    };
    fs.writeFileSync(testDeployedPath, JSON.stringify(testData, null, 2));
  });

  // Cleanup test file
  after(function () {
    if (fs.existsSync(testDeployedPath)) {
      fs.unlinkSync(testDeployedPath);
    }
  });

  describe('ContractAddresses', function () {
    it('should create instance with default config', function () {
      const contracts = new ContractAddresses();
      assert.strictEqual(contracts instanceof ContractAddresses, true);
    });

    it('should load addresses from file', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      const hasher = contracts.getHasher();
      assert.strictEqual(hasher, '0x1111111111111111111111111111111111111111');
    });

    it('should return null for non-existent contract', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      const result = contracts.get('NonExistent');
      assert.strictEqual(result, null);
    });

    it('should get registry address', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      const registry = contracts.getRegistry();
      assert.strictEqual(registry, '0x2222222222222222222222222222222222222222');
    });

    it('should get account factory address', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      const factory = contracts.getAccountFactory();
      assert.strictEqual(factory, '0x3333333333333333333333333333333333333333');
    });

    it('should get first runner address', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      const runner = contracts.getFirstRunner();
      assert.strictEqual(runner, '0x4444444444444444444444444444444444444444');
    });

    it('should get all runner addresses', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      const runners = contracts.getAllRunners();
      assert.strictEqual(Array.isArray(runners), true);
      assert.strictEqual(runners.length, 2);
    });

    it('should return default entry point address', function () {
      const contracts = new ContractAddresses();

      const entryPoint = contracts.getEntryPoint();
      assert.strictEqual(entryPoint, POLYGON_AMOY_ADDRESSES.entryPoint);
    });

    it('should allow manual address override', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      contracts.set('Registry', '0x9999999999999999999999999999999999999999');

      const registry = contracts.getRegistry();
      assert.strictEqual(registry, '0x9999999999999999999999999999999999999999');
    });

    it('should prioritize manual override over file', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
        addresses: {
          Registry: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      });

      const registry = contracts.getRegistry();
      assert.strictEqual(registry, '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    });

    it('should get all addresses', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      const all = contracts.getAll();
      assert.strictEqual(typeof all, 'object');
      assert.strictEqual(all.Hasher, '0x1111111111111111111111111111111111111111');
    });

    it('should clear cache', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      // Load cache
      contracts.getHasher();

      // Clear cache
      contracts.clearCache();

      // Should still work after clear
      const hasher = contracts.getHasher();
      assert.strictEqual(hasher, '0x1111111111111111111111111111111111111111');
    });

    it('should handle missing file gracefully', function () {
      const contracts = new ContractAddresses({
        deployedContractsPath: '/non/existent/path.json',
      });

      const result = contracts.get('SomeContract');
      assert.strictEqual(result, null);
    });
  });

  describe('createContractAddresses', function () {
    it('should create instance via factory function', function () {
      const contracts = createContractAddresses({
        deployedContractsPath: testDeployedPath,
      });

      assert.strictEqual(contracts instanceof ContractAddresses, true);
    });

    it('should create instance without config', function () {
      const contracts = createContractAddresses();
      assert.strictEqual(contracts instanceof ContractAddresses, true);
    });
  });

  describe('ABIs', function () {
    it('should export ABIs object', function () {
      assert.strictEqual(typeof ABIs, 'object');
    });

    it('should have MyAccountFactory ABI', function () {
      assert.strictEqual(Array.isArray(ABIs.MyAccountFactory), true);
      assert.strictEqual(ABIs.MyAccountFactory.length > 0, true);
    });

    it('should have MyAccount ABI', function () {
      assert.strictEqual(Array.isArray(ABIs.MyAccount), true);
      assert.strictEqual(ABIs.MyAccount.length > 0, true);
    });

    it('should have MerkleRegistry ABI', function () {
      assert.strictEqual(Array.isArray(ABIs.MerkleRegistry), true);
      assert.strictEqual(ABIs.MerkleRegistry.length > 0, true);
    });

    it('should have Runner ABI', function () {
      assert.strictEqual(Array.isArray(ABIs.Runner), true);
      assert.strictEqual(ABIs.Runner.length > 0, true);
    });

    it('should have VerifyingPaymaster ABI', function () {
      assert.strictEqual(Array.isArray(ABIs.VerifyingPaymaster), true);
      assert.strictEqual(ABIs.VerifyingPaymaster.length > 0, true);
    });

    it('should have UserData ABI', function () {
      assert.strictEqual(Array.isArray(ABIs.UserData), true);
      assert.strictEqual(ABIs.UserData.length > 0, true);
    });

    it('should have EntryPoint ABI', function () {
      assert.strictEqual(Array.isArray(ABIs.EntryPoint), true);
      assert.strictEqual(ABIs.EntryPoint.length > 0, true);
    });

    it('should have valid ABI format', function () {
      // All ABIs should contain function signatures
      for (const [name, abi] of Object.entries(ABIs)) {
        assert.strictEqual(Array.isArray(abi), true, `${name} should be an array`);
        for (const item of abi) {
          assert.strictEqual(typeof item, 'string', `${name} items should be strings`);
        }
      }
    });
  });

  describe('POLYGON_AMOY_ADDRESSES', function () {
    it('should export polygon amoy addresses', function () {
      assert.strictEqual(typeof POLYGON_AMOY_ADDRESSES, 'object');
    });

    it('should have entry point address', function () {
      assert.strictEqual(typeof POLYGON_AMOY_ADDRESSES.entryPoint, 'string');
      assert.strictEqual(POLYGON_AMOY_ADDRESSES.entryPoint.startsWith('0x'), true);
      assert.strictEqual(POLYGON_AMOY_ADDRESSES.entryPoint.length, 42);
    });
  });
});
