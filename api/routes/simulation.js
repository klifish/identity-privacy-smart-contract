const express = require('express');
const path = require('path');
const {
  simulateSingleUser,
  simulateMultipleUsersWithPrivacy,
  simulateMultipleUsersWithStandard,
  getWalletsFromFile,
} = require('../../simulation/user');
const { generateWallets, generateSecrets, fund } = require('../../simulation/walletManager');
const {
  retrieveBlockRangeData,
  getTransactionHashesFromBlocks,
  getAllTransactionData,
  getTransactionHashesFromBlocksWithTimestamp,
  readAllBlockData,
  readAllTransactionData,
  readAllTransactionDataWithTimestamp,
} = require('../../simulation/retrieveBlockData');
const { getTransactionByHash } = require('../../simulation/transactionGraph');
const { asyncHandler, normalizeBigInt } = require('../utils');

const router = express.Router();
const defaultWalletPath = path.join(__dirname, '..', '..', 'simulation', 'wallets.json');

router.post(
  '/single-user',
  asyncHandler(async (req, res) => {
    const { secret, mode = 'standard' } = req.body || {};

    if (!secret) {
      return res.status(400).json({ error: 'secret is required' });
    }

    await simulateSingleUser(secret, mode.toLowerCase());
    res.json({ status: 'ok' });
  })
);

router.post(
  '/multiple-users',
  asyncHandler(async (req, res) => {
    const { wallets, mode = 'standard' } = req.body || {};

    if (!Array.isArray(wallets) || wallets.length === 0) {
      return res.status(400).json({ error: 'wallets array is required' });
    }

    if (mode.toLowerCase() === 'privacy') {
      await simulateMultipleUsersWithPrivacy(wallets);
    } else {
      await simulateMultipleUsersWithStandard(wallets);
    }

    res.json({ status: 'ok' });
  })
);

router.get(
  '/wallets',
  asyncHandler(async (req, res) => {
    const walletPath = req.query.path || defaultWalletPath;
    const wallets = getWalletsFromFile(walletPath);
    res.json(normalizeBigInt(wallets));
  })
);

router.post(
  '/wallets',
  asyncHandler(async (req, res) => {
    const { count = 10, generateSecret = true, fundWallets = false } = req.body || {};

    await generateWallets(count);
    if (generateSecret) {
      await generateSecrets();
    }
    if (fundWallets) {
      await fund();
    }

    const wallets = getWalletsFromFile(defaultWalletPath);
    res.json(normalizeBigInt(wallets));
  })
);

router.post(
  '/blocks',
  asyncHandler(async (req, res) => {
    const { startBlock, endBlock, includeTransactions = false, includeTraces = false } = req.body || {};

    if (startBlock == null || endBlock == null) {
      return res.status(400).json({ error: 'startBlock and endBlock are required' });
    }

    const blocks = await retrieveBlockRangeData(startBlock, endBlock);
    let txHashes = [];
    let transactions = [];

    if (includeTransactions || includeTraces) {
      txHashes = includeTraces
        ? getTransactionHashesFromBlocksWithTimestamp(blocks)
        : getTransactionHashesFromBlocks(blocks);

      if (includeTraces) {
        transactions = await getAllTransactionData(txHashes);
      }
    }

    res.json({
      startBlock,
      endBlock,
      blockCount: blocks.length,
      transactionCount: txHashes.length,
      tracedCount: transactions.length,
    });
  })
);

router.post(
  '/transactions/trace',
  asyncHandler(async (req, res) => {
    const { txHash } = req.body || {};

    if (!txHash) {
      return res.status(400).json({ error: 'txHash is required' });
    }

    const trace = await getTransactionByHash(txHash);
    res.json(trace);
  })
);

router.get(
  '/transactions/cache',
  asyncHandler(async (req, res) => {
    const { startBlock, endBlock, withTimestamp } = req.query;

    if (withTimestamp) {
      const data = readAllTransactionDataWithTimestamp();
      res.json(data);
      return;
    }

    if (startBlock && endBlock) {
      const blocks = readAllBlockData(Number(startBlock), Number(endBlock));
      res.json(blocks);
      return;
    }

    const data = readAllTransactionData();
    res.json(data);
  })
);

module.exports = router;
