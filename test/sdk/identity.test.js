/**
 * Identity Module Tests
 */

const assert = require('assert');
const { calculateLeaf } = require('../../src/identity');

describe('Identity Module', function () {
  this.timeout(30000); // Crypto operations can be slow

  describe('calculateLeaf', function () {
    it('should calculate leaf from credentials', async function () {
      const address = '0x1234567890123456789012345678901234567890';
      const secret = 'test-secret';
      const nullifier = 0n;

      const leaf = await calculateLeaf(address, secret, nullifier);

      assert.strictEqual(typeof leaf, 'bigint');
      assert.strictEqual(leaf > 0n, true);
    });

    it('should produce consistent results for same inputs', async function () {
      const address = '0x1234567890123456789012345678901234567890';
      const secret = 'my-secret';
      const nullifier = 1n;

      const leaf1 = await calculateLeaf(address, secret, nullifier);
      const leaf2 = await calculateLeaf(address, secret, nullifier);

      assert.strictEqual(leaf1, leaf2);
    });

    it('should produce different leaves for different addresses', async function () {
      const address1 = '0x1234567890123456789012345678901234567890';
      const address2 = '0x0987654321098765432109876543210987654321';
      const secret = 'same-secret';
      const nullifier = 0n;

      const leaf1 = await calculateLeaf(address1, secret, nullifier);
      const leaf2 = await calculateLeaf(address2, secret, nullifier);

      assert.notStrictEqual(leaf1, leaf2);
    });

    it('should produce different leaves for different secrets', async function () {
      const address = '0x1234567890123456789012345678901234567890';
      const nullifier = 0n;

      const leaf1 = await calculateLeaf(address, 'secret1', nullifier);
      const leaf2 = await calculateLeaf(address, 'secret2', nullifier);

      assert.notStrictEqual(leaf1, leaf2);
    });

    it('should produce different leaves for different nullifiers', async function () {
      const address = '0x1234567890123456789012345678901234567890';
      const secret = 'same-secret';

      const leaf1 = await calculateLeaf(address, secret, 0n);
      const leaf2 = await calculateLeaf(address, secret, 1n);

      assert.notStrictEqual(leaf1, leaf2);
    });
  });

  // Note: IdentityClient tests require network connection and deployed contracts
  // These are better suited for integration tests
  describe('IdentityClient', function () {
    it('should be importable', function () {
      const { IdentityClient } = require('../../src/identity');
      assert.strictEqual(typeof IdentityClient, 'function');
    });

    it('should throw error when creating without config', function () {
      const { IdentityClient } = require('../../src/identity');
      assert.throws(() => new IdentityClient({}), Error);
    });
  });
});
