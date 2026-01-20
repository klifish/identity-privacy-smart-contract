/**
 * UserOp Module Tests
 */

const assert = require('assert');
const { ethers } = require('ethers');
const {
  fillUserOpDefaults,
  packAccountGasLimits,
  packPaymasterData,
  packUserOp,
  encodeUserOp,
  getUserOpHash,
  getCallData,
  getDefaultUserOp,
  DefaultsForUserOp,
} = require('../../src/userOp');

describe('UserOp Module', function () {
  const testAddress = '0x1234567890123456789012345678901234567890';
  const testPaymaster = '0x0987654321098765432109876543210987654321';
  const entryPointAddress = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  const chainId = 80002;

  describe('fillUserOpDefaults', function () {
    it('should fill missing fields with defaults', function () {
      const partial = { sender: testAddress };
      const result = fillUserOpDefaults(partial);

      assert.strictEqual(result.sender, testAddress);
      assert.strictEqual(result.nonce, DefaultsForUserOp.nonce);
      assert.strictEqual(result.initCode, DefaultsForUserOp.initCode);
      assert.strictEqual(result.callData, DefaultsForUserOp.callData);
    });

    it('should not override provided values', function () {
      const partial = {
        sender: testAddress,
        nonce: 5,
        callGasLimit: 100000,
      };
      const result = fillUserOpDefaults(partial);

      assert.strictEqual(result.nonce, 5);
      assert.strictEqual(result.callGasLimit, 100000);
    });

    it('should remove null values before merging', function () {
      const partial = {
        sender: testAddress,
        nonce: null,
      };
      const result = fillUserOpDefaults(partial);

      assert.strictEqual(result.nonce, DefaultsForUserOp.nonce);
    });

    it('should use custom defaults if provided', function () {
      const customDefaults = {
        ...DefaultsForUserOp,
        nonce: 100,
      };
      const result = fillUserOpDefaults({}, customDefaults);

      assert.strictEqual(result.nonce, 100);
    });
  });

  describe('packAccountGasLimits', function () {
    it('should pack gas limits into bytes32', function () {
      const result = packAccountGasLimits(150000, 100000);

      assert.strictEqual(typeof result, 'string');
      assert.strictEqual(result.startsWith('0x'), true);
      assert.strictEqual(result.length, 66); // 0x + 64 hex chars
    });

    it('should handle BigInt inputs', function () {
      const result = packAccountGasLimits(150000n, 100000n);

      assert.strictEqual(typeof result, 'string');
      assert.strictEqual(result.startsWith('0x'), true);
    });

    it('should produce consistent results', function () {
      const result1 = packAccountGasLimits(150000, 100000);
      const result2 = packAccountGasLimits(150000, 100000);

      assert.strictEqual(result1, result2);
    });
  });

  describe('packPaymasterData', function () {
    it('should pack paymaster data correctly', function () {
      const result = packPaymasterData(testPaymaster, 30000, 50000, '0x1234');

      assert.strictEqual(typeof result, 'string');
      assert.strictEqual(result.startsWith('0x'), true);
      // Should contain: 20 bytes address + 16 bytes + 16 bytes + data
      assert.strictEqual(result.length > 66, true);
    });

    it('should include paymaster address', function () {
      const result = packPaymasterData(testPaymaster, 30000, 50000, '0x');

      assert.strictEqual(
        result.toLowerCase().includes(testPaymaster.slice(2).toLowerCase()),
        true
      );
    });
  });

  describe('packUserOp', function () {
    it('should pack a complete UserOperation', function () {
      const userOp = fillUserOpDefaults({
        sender: testAddress,
        nonce: 1,
        callData: '0x1234',
      });

      const packed = packUserOp(userOp);

      assert.strictEqual(packed.sender, testAddress);
      assert.strictEqual(packed.nonce, 1);
      assert.strictEqual(packed.callData, '0x1234');
      assert.strictEqual(typeof packed.accountGasLimits, 'string');
      assert.strictEqual(typeof packed.gasFees, 'string');
    });

    it('should handle paymaster data', function () {
      const userOp = fillUserOpDefaults({
        sender: testAddress,
        paymaster: testPaymaster,
        paymasterData: '0xabcd',
        paymasterVerificationGasLimit: 30000,
        paymasterPostOpGasLimit: 50000,
      });

      const packed = packUserOp(userOp);

      assert.notStrictEqual(packed.paymasterAndData, '0x');
    });

    it('should set paymasterAndData to 0x when no paymaster', function () {
      const userOp = fillUserOpDefaults({
        sender: testAddress,
        paymaster: ethers.ZeroAddress,
      });

      const packed = packUserOp(userOp);

      assert.strictEqual(packed.paymasterAndData, '0x');
    });
  });

  describe('getUserOpHash', function () {
    it('should calculate hash for UserOperation', function () {
      const userOp = fillUserOpDefaults({
        sender: testAddress,
        nonce: 1,
        callData: '0x1234',
      });

      const hash = getUserOpHash(userOp, entryPointAddress, chainId);

      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.startsWith('0x'), true);
      assert.strictEqual(hash.length, 66); // bytes32
    });

    it('should produce consistent hashes', function () {
      const userOp = fillUserOpDefaults({
        sender: testAddress,
        nonce: 1,
      });

      const hash1 = getUserOpHash(userOp, entryPointAddress, chainId);
      const hash2 = getUserOpHash(userOp, entryPointAddress, chainId);

      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different nonces', function () {
      const userOp1 = fillUserOpDefaults({ sender: testAddress, nonce: 1 });
      const userOp2 = fillUserOpDefaults({ sender: testAddress, nonce: 2 });

      const hash1 = getUserOpHash(userOp1, entryPointAddress, chainId);
      const hash2 = getUserOpHash(userOp2, entryPointAddress, chainId);

      assert.notStrictEqual(hash1, hash2);
    });

    it('should produce different hashes for different chain IDs', function () {
      const userOp = fillUserOpDefaults({ sender: testAddress, nonce: 1 });

      const hash1 = getUserOpHash(userOp, entryPointAddress, 1);
      const hash2 = getUserOpHash(userOp, entryPointAddress, 137);

      assert.notStrictEqual(hash1, hash2);
    });

    it('should produce different hashes for different entry points', function () {
      const userOp = fillUserOpDefaults({ sender: testAddress, nonce: 1 });
      const otherEntryPoint = '0x1111111111111111111111111111111111111111';

      const hash1 = getUserOpHash(userOp, entryPointAddress, chainId);
      const hash2 = getUserOpHash(userOp, otherEntryPoint, chainId);

      assert.notStrictEqual(hash1, hash2);
    });
  });

  describe('getCallData', function () {
    it('should encode execute call data', function () {
      const dest = testAddress;
      const value = 0;
      const func = '0x1234';

      const callData = getCallData(dest, value, func);

      assert.strictEqual(typeof callData, 'string');
      assert.strictEqual(callData.startsWith('0x'), true);
      // Should be longer than just the function selector
      assert.strictEqual(callData.length > 10, true);
    });

    it('should handle different function data', function () {
      const dest = testAddress;
      const value = 0;

      const callData1 = getCallData(dest, value, '0x1234');
      const callData2 = getCallData(dest, value, '0x5678');

      assert.notStrictEqual(callData1, callData2);
    });

    it('should handle non-zero value', function () {
      const callData = getCallData(testAddress, 1000000, '0x');

      assert.strictEqual(typeof callData, 'string');
      assert.strictEqual(callData.startsWith('0x'), true);
    });
  });

  describe('getDefaultUserOp', function () {
    it('should create a default UserOperation', function () {
      const userOp = getDefaultUserOp(testAddress, testPaymaster);

      assert.strictEqual(userOp.sender, testAddress);
      assert.strictEqual(userOp.paymaster, testPaymaster);
      assert.strictEqual(typeof userOp.callGasLimit, 'string');
      assert.strictEqual(typeof userOp.verificationGasLimit, 'string');
    });

    it('should include paymaster data', function () {
      const userOp = getDefaultUserOp(testAddress, testPaymaster);

      assert.strictEqual(typeof userOp.paymasterData, 'string');
      assert.strictEqual(userOp.paymasterData.startsWith('0x'), true);
    });

    it('should accept validity options', function () {
      const userOp = getDefaultUserOp(testAddress, testPaymaster, {
        validUntil: 1000000,
        validAfter: 500000,
      });

      assert.strictEqual(userOp.sender, testAddress);
    });
  });

  describe('encodeUserOp', function () {
    it('should encode UserOp for signature', function () {
      const userOp = fillUserOpDefaults({ sender: testAddress, nonce: 1 });
      const encoded = encodeUserOp(userOp, true);

      assert.strictEqual(typeof encoded, 'string');
      assert.strictEqual(encoded.startsWith('0x'), true);
    });

    it('should encode UserOp for storage', function () {
      const userOp = fillUserOpDefaults({ sender: testAddress, nonce: 1 });
      const encoded = encodeUserOp(userOp, false);

      assert.strictEqual(typeof encoded, 'string');
      assert.strictEqual(encoded.startsWith('0x'), true);
    });

    it('should produce different encodings for signature vs storage', function () {
      const userOp = fillUserOpDefaults({ sender: testAddress, nonce: 1 });

      const forSig = encodeUserOp(userOp, true);
      const forStorage = encodeUserOp(userOp, false);

      assert.notStrictEqual(forSig, forStorage);
    });
  });
});
