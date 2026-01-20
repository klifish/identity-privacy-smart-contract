/**
 * Utils Module Tests
 */

const assert = require('assert');
const {
  bitsToNum,
  numToBits,
  p256,
  computePedersenHash,
  pedersenHashMultipleInputs,
  address2Uint8Array32,
} = require('../../src/utils');

describe('Utils Module', function () {
  this.timeout(30000); // ZKP operations can be slow

  describe('bitsToNum', function () {
    it('should convert bits array to BigInt', function () {
      const bits = [1, 0, 1, 0]; // binary 0101 = 5
      const result = bitsToNum(bits);
      assert.strictEqual(result, 5n);
    });

    it('should handle all zeros', function () {
      const bits = [0, 0, 0, 0];
      const result = bitsToNum(bits);
      assert.strictEqual(result, 0n);
    });

    it('should handle all ones', function () {
      const bits = [1, 1, 1, 1]; // binary 1111 = 15
      const result = bitsToNum(bits);
      assert.strictEqual(result, 15n);
    });

    it('should throw error for non-array input', function () {
      assert.throws(() => bitsToNum('101'), /Input must be an array/);
    });

    it('should throw error for invalid bit values', function () {
      assert.throws(() => bitsToNum([0, 1, 2]), /Bits array must contain only 0 or 1/);
    });
  });

  describe('numToBits', function () {
    it('should convert BigInt to bits array', function () {
      const result = numToBits(5n, 4);
      assert.deepStrictEqual(result, [1, 0, 1, 0]);
    });

    it('should handle zero', function () {
      const result = numToBits(0n, 4);
      assert.deepStrictEqual(result, [0, 0, 0, 0]);
    });

    it('should handle larger numbers', function () {
      const result = numToBits(255n, 8);
      assert.deepStrictEqual(result, [1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('should throw error for non-BigInt input', function () {
      assert.throws(() => numToBits(5, 4), /Input value must be a BigInt/);
    });

    it('should be inverse of bitsToNum', function () {
      const original = 12345n;
      const bits = numToBits(original, 16);
      const result = bitsToNum(bits);
      assert.strictEqual(result, original);
    });
  });

  describe('p256', function () {
    it('should format number to 256-bit hex string', function () {
      const result = p256(255n);
      assert.strictEqual(result.length, 66); // 0x + 64 chars
      assert.strictEqual(result.startsWith('0x'), true);
      assert.strictEqual(result, '0x00000000000000000000000000000000000000000000000000000000000000ff');
    });

    it('should handle zero', function () {
      const result = p256(0n);
      assert.strictEqual(result, '0x' + '0'.repeat(64));
    });

    it('should handle string input', function () {
      const result = p256('255');
      assert.strictEqual(result.endsWith('ff'), true);
    });
  });

  describe('computePedersenHash', function () {
    it('should compute hash for a string', async function () {
      const hash = await computePedersenHash('hello');
      assert.strictEqual(typeof hash, 'bigint');
      assert.strictEqual(hash > 0n, true);
    });

    it('should produce consistent results', async function () {
      const hash1 = await computePedersenHash('test');
      const hash2 = await computePedersenHash('test');
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different inputs', async function () {
      const hash1 = await computePedersenHash('hello');
      const hash2 = await computePedersenHash('world');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should throw error for empty string', async function () {
      await assert.rejects(
        async () => computePedersenHash(''),
        /Message must be a non-empty string/
      );
    });

    it('should throw error for non-string input', async function () {
      await assert.rejects(
        async () => computePedersenHash(123),
        /Message must be a non-empty string/
      );
    });
  });

  describe('pedersenHashMultipleInputs', function () {
    it('should hash multiple inputs', async function () {
      const hash = await pedersenHashMultipleInputs([1n, 2n, 3n]);
      assert.strictEqual(hash instanceof Uint8Array, true);
      assert.strictEqual(hash.length > 0, true);
    });

    it('should produce consistent results', async function () {
      const hash1 = await pedersenHashMultipleInputs([100n, 200n]);
      const hash2 = await pedersenHashMultipleInputs([100n, 200n]);
      assert.deepStrictEqual(hash1, hash2);
    });

    it('should throw error for non-array input', async function () {
      await assert.rejects(
        async () => pedersenHashMultipleInputs('not an array'),
        /Inputs must be an array/
      );
    });
  });

  describe('address2Uint8Array32', function () {
    it('should convert address to 32-byte Uint8Array', function () {
      const address = '0x1234567890123456789012345678901234567890';
      const result = address2Uint8Array32(address);
      assert.strictEqual(result instanceof Uint8Array, true);
      assert.strictEqual(result.length, 32);
    });

    it('should handle zero address', function () {
      const address = '0x0000000000000000000000000000000000000000';
      const result = address2Uint8Array32(address);
      assert.strictEqual(result.length, 32);
    });
  });
});
