const path = require("path");
const { MOCK_VALID_UNTIL, MOCK_VALID_AFTER, ENTRY_POINT_ADDRESS } = require('../scripts/sharedConstants');

const NUM_USERS = 10;

const wasm = path.join(__dirname, "..", "build", "circuits", "commitment_js", "commitment.wasm");
const zkey = path.join(__dirname, "..", "build", "circuits", "commitment_final.zkey");
const walletsFilePath = "./simulation/wallets.json";

const BUNDLER_URL = 'https://polygon-amoy.g.alchemy.com/v2/VG6iwUaOlQPYcDCb3AlkyAxrAXF7UzU9';
const ENTRY_POINT_V07_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

module.exports = {
    MOCK_VALID_UNTIL,
    MOCK_VALID_AFTER,
    ENTRY_POINT_ADDRESS,
    NUM_USERS,
    wasm,
    zkey,
    walletsFilePath,
    BUNDLER_URL,
    ENTRY_POINT_V07_ADDRESS
};
