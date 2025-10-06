const express = require('express');
const { computePedersenHash } = require('../../scripts/utils');
const { createSmartAccount, getSender } = require('../../scripts/userManagement/createSmartAccount');
const { calculateLeaf, registerUserWithLeaf, generateProof } = require('../../scripts/registerUser');
const {
  deployUserDataWithSmartAccountSingle,
  deployUserDataContractWithPrivacySingle,
  updateUserDataWithSmartAccount,
  updateUserDataWithPrivacySingle,
} = require('../../simulation/userDataDeployer');
const { registerUserSmartWallet } = require('../../simulation/smartAccountManager');
const { asyncHandler, parseBigInt, normalizeBigInt } = require('../utils');

const router = express.Router();

router.post(
  '/smart-accounts',
  asyncHandler(async (req, res) => {
    const { secret, countId = 0, salt = 1, register = false, nullifier } = req.body || {};

    if (!secret || typeof secret !== 'string') {
      return res.status(400).json({ error: 'secret must be provided as string' });
    }

    const commitment = await computePedersenHash(`${secret}${countId}`);
    const smartAccountAddress = await getSender(commitment, salt);
    await createSmartAccount(commitment);

    const response = {
      smartAccountAddress,
      commitment,
      salt,
      countId,
    };

    if (register) {
      const nullifierValue = parseBigInt(nullifier, 0n);
      const leaf = await calculateLeaf(smartAccountAddress, secret, nullifierValue);
      await registerUserWithLeaf(leaf);
      response.nullifier = nullifierValue;
      response.leaf = leaf;
    }

    res.json(normalizeBigInt(response));
  })
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { smartAccountAddress, secret, nullifier } = req.body || {};

    if (!smartAccountAddress || !secret) {
      return res.status(400).json({ error: 'smartAccountAddress and secret are required' });
    }

    const nullifierValue = parseBigInt(nullifier, 0n);
    const leaf = await calculateLeaf(smartAccountAddress, secret, nullifierValue);
    await registerUserWithLeaf(leaf);

    res.json(
      normalizeBigInt({
        smartAccountAddress,
        leaf,
        nullifier: nullifierValue,
      })
    );
  })
);

router.post(
  '/proof',
  asyncHandler(async (req, res) => {
    const { smartAccountAddress, secret, nullifier } = req.body || {};

    if (!smartAccountAddress || !secret) {
      return res.status(400).json({ error: 'smartAccountAddress and secret are required' });
    }

    const nullifierValue = parseBigInt(nullifier, 0n);
    const proof = await generateProof(smartAccountAddress, secret, nullifierValue);

    res.json({ proof, nullifier: nullifierValue.toString() });
  })
);

router.post(
  '/user-data/deploy',
  asyncHandler(async (req, res) => {
    const { smartAccountAddress, secret, mode = 'standard', nullifier, autoRegister = false } = req.body || {};

    if (!smartAccountAddress || !secret) {
      return res.status(400).json({ error: 'smartAccountAddress and secret are required' });
    }

    const modeLower = mode.toLowerCase();
    const nullifierValue = parseBigInt(nullifier, 0n);

    if (autoRegister && modeLower === 'privacy') {
      await registerUserSmartWallet(secret, smartAccountAddress, nullifierValue);
    }

    let userDataAddress;
    if (modeLower === 'privacy') {
      userDataAddress = await deployUserDataContractWithPrivacySingle(secret, smartAccountAddress, nullifierValue);
    } else {
      userDataAddress = await deployUserDataWithSmartAccountSingle(secret, smartAccountAddress);
    }

    res.json({ smartAccountAddress, userDataAddress });
  })
);

router.post(
  '/user-data/update',
  asyncHandler(async (req, res) => {
    const { smartAccountAddress, secret, userDataAddress, mode = 'standard', nullifier } = req.body || {};

    if (!smartAccountAddress || !secret || !userDataAddress) {
      return res.status(400).json({ error: 'smartAccountAddress, secret, and userDataAddress are required' });
    }

    const modeLower = mode.toLowerCase();
    const nullifierValue = parseBigInt(nullifier, 0n);

    if (modeLower === 'privacy') {
      await updateUserDataWithPrivacySingle(secret, smartAccountAddress, userDataAddress, nullifierValue);
    } else {
      await updateUserDataWithSmartAccount(secret, smartAccountAddress, userDataAddress);
    }

    res.json({ status: 'ok' });
  })
);

module.exports = router;
