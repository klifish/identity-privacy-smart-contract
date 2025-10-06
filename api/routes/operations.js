const express = require('express');
const { waitForUserOperationToBePacked, waitForTransactionToBeMined, sendUserOperationToBundler } = require('../../simulation/bundlerUtils');
const { getUserOpHash, packUserOp } = require('../../scripts/userOp');
const { asyncHandler, normalizeBigInt } = require('../utils');

const router = express.Router();

router.post(
  '/send-user-op',
  asyncHandler(async (req, res) => {
    const { userOp } = req.body || {};
    if (!userOp || typeof userOp !== 'object') {
      return res.status(400).json({ error: 'userOp object is required' });
    }

    const response = await sendUserOperationToBundler(userOp);
    res.json(response);
  })
);

router.post(
  '/user-op-status',
  asyncHandler(async (req, res) => {
    const { userOpHash, maxAttempts, delayMs } = req.body || {};
    if (!userOpHash) {
      return res.status(400).json({ error: 'userOpHash is required' });
    }

    const txHash = await waitForUserOperationToBePacked(userOpHash, maxAttempts, delayMs);
    res.json({ txHash });
  })
);

router.post(
  '/transaction-status',
  asyncHandler(async (req, res) => {
    const { txHash, maxAttempts, delayMs } = req.body || {};
    if (!txHash) {
      return res.status(400).json({ error: 'txHash is required' });
    }

    const receipt = await waitForTransactionToBeMined(txHash, maxAttempts, delayMs);
    res.json(normalizeBigInt(receipt));
  })
);

router.post(
  '/user-op-hash',
  asyncHandler(async (req, res) => {
    const { userOp, entryPointAddress, chainId } = req.body || {};
    if (!userOp || !entryPointAddress || chainId == null) {
      return res.status(400).json({ error: 'userOp, entryPointAddress, and chainId are required' });
    }

    const hash = getUserOpHash(userOp, entryPointAddress, Number(chainId));
    res.json({ userOpHash: hash });
  })
);

router.post(
  '/pack-user-op',
  asyncHandler(async (req, res) => {
    const { userOp } = req.body || {};
    if (!userOp) {
      return res.status(400).json({ error: 'userOp is required' });
    }

    const packed = packUserOp(userOp);
    res.json(normalizeBigInt(packed));
  })
);

module.exports = router;
