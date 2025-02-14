const fs = require('fs');
const path = require('path');
const deployedContractsPath = path.join(__dirname, './deployedContracts.json');
async function isDeployed(contractName) {
    let deployedContracts = {};
    if (fs.existsSync(deployedContractsPath)) {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }

    if (deployedContracts[contractName]) {
        return true;
    }
    return false;
}

async function setDeployed(contractName, address) {
    let deployedContracts = {};
    if (fs.existsSync(deployedContractsPath)) {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }

    deployedContracts[contractName] = address;
    fs.writeFileSync(deployedContractsPath, JSON.stringify(deployedContracts, null, 2));
}

async function getDeployed(contractName) {
    let deployedContracts = {};
    if (fs.existsSync(deployedContractsPath)) {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }

    return deployedContracts[contractName];
}

module.exports = { isDeployed, setDeployed, getDeployed }