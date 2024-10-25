/** @type import('hardhat/config').HardhatUserConfig */

require('dotenv').config();
// require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const {API_URL, PRIVATE_KEY} = process.env;

module.exports = {
  solidity: "0.8.27",
  defaultNetwork: "localhost",
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    polygonAmoy: {
      url: API_URL,
      accounts: [`0x${PRIVATE_KEY}`]
    }
  }
};
