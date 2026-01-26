/**
 * ZKP Module Integration Tests
 */

const assert = require('assert');
const path = require('path');
const snarkjs = require('snarkjs');
const ffjavascript = require('ffjavascript');

const { ZKPClient } = require('../../src/zkp');

const FIELD_SIZE = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

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

describe('ZKP Module - Integration Tests', function () {
  this.timeout(300000);

  const circuitsPath = path.resolve(__dirname, '../../build/circuits');
  const client = new ZKPClient({ circuitsPath, merkleTreeLevel: 20 });

  it('should generate and verify a registration proof', async function () {
    const secret = 'zkp-secret';
    const nullifier = 123n;

    const leaf = await client.calculateLeaf(secret, nullifier);
    const leaves = [leaf, 2n, 3n, 4n];

    const merkleProof = await client.buildMerkleProof({ secret, nullifier, leaves });

    const input = {
      root: merkleProof.pathRoot,
      nullifierHash: '987654321',
      recipient: '100',
      relayer: '50',
      fee: '10',
      refund: '5',
      nullifier: normalizeToFieldElement(BigInt(nullifier)),
      secret: normalizeToFieldElement(parseSecretToBigInt(secret)),
      pathElements: merkleProof.pathElements,
      pathIndices: merkleProof.pathIndices,
    };

    const wasmPath = path.join(circuitsPath, 'register_js', 'register.wasm');
    const zkeyPath = path.join(circuitsPath, 'register_final.zkey');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    const verified = await client.verifyProofLocally(proof, publicSignals, 'register');
    assert.strictEqual(verified, true);

    const result = await client.generateRegistrationProof({ secret, nullifier, leaves });
    assert.strictEqual(typeof result.proof, 'string');
    assert.strictEqual(result.proof.startsWith('0x'), true);
    assert.strictEqual(result.root, merkleProof.pathRoot);
    assert.strictEqual(result.publicInputs.length > 0, true);
  });

  it('should generate and verify a commitment proof', async function () {
    const secret = 'commitment-secret';
    const domain = 'domain';
    const encoded = new TextEncoder().encode(secret + domain);
    const input = {
      secret: ffjavascript.utils.leBuff2int(encoded),
    };

    const wasmPath = path.join(circuitsPath, 'commitment_js', 'commitment.wasm');
    const zkeyPath = path.join(circuitsPath, 'commitment_final.zkey');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    const verified = await client.verifyProofLocally(proof, publicSignals, 'commitment');
    assert.strictEqual(verified, true);

    const result = await client.generateCommitmentProof(secret, domain);
    assert.strictEqual(typeof result.proof, 'string');
    assert.strictEqual(result.proof.startsWith('0x'), true);
    assert.strictEqual(result.publicInputs.length > 0, true);
  });
});
