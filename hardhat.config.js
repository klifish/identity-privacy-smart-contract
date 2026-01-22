/** @type import('hardhat/config').HardhatUserConfig */

require('dotenv').config();
// require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-ignition-ethers");

const { API_URL, PRIVATE_KEY } = process.env;

module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "localhost",
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
      allowUnlimitedContractSize: true, // @kun For testing purposes, we allow unlimited contract sizes
    },
    polygonAmoy: {
      url: API_URL,
      accounts: [`${PRIVATE_KEY}`]
    }
  }
};
