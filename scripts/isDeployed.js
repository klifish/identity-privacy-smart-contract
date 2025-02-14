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
    if (contractName === "Runner") {
        if (!Array.isArray(deployedContracts["Runner"])) {
            deployedContracts["Runner"] = [];
        }
        deployedContracts["Runner"].push(address);
    } else {
        deployedContracts[contractName] = address;
    }

    fs.writeFileSync(deployedContractsPath, JSON.stringify(deployedContracts, null, 2));
}

async function getDeployed(contractName) {
    let deployedContracts = {};
    if (fs.existsSync(deployedContractsPath)) {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }

    return deployedContracts[contractName];
}

async function getHasherAddress() {
    return await getDeployed("Hasher");
}

async function getRegistryAddress() {
    return await getDeployed("Registry");
}

async function getRegisterVerifierAddress() {
    return await getDeployed("RegisterVerifier");
}

async function getRunnerFactoryAddress() {
    return await getDeployed("RunnerFactory");
}

module.exports = { isDeployed, setDeployed, getDeployed, getHasherAddress, getRegistryAddress, getRegisterVerifierAddress, getRunnerFactoryAddress }