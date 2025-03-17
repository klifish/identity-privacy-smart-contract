const fs = require('fs');
const path = require('path');
const deployedContractsPath = path.join(__dirname, './deployedContracts.json');
async function isDeployed(contractName) {
    let deployedContracts = {};
    if (fs.existsSync(deployedContractsPath)) {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }

    if (typeof deployedContracts[contractName] !== "undefined" && deployedContracts[contractName] !== "") {
        return true;
    } else {
        return false;
    }

    if (typeof deployedContracts[contractName] === "undefined") {
        return false;
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

async function getRandomRunnerAddress() {
    let deployedContracts = {};
    if (fs.existsSync(deployedContractsPath)) {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }

    return deployedContracts["Runner"][Math.floor(Math.random() * deployedContracts["Runner"].length)];
}

async function getFirstRunnerAddress() {
    let deployedContracts = {};
    if (fs.existsSync(deployedContractsPath)) {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }

    return deployedContracts["Runner"][0];
}

async function getHasherAddress() {
    return await getDeployed("Hasher");
}

async function getVerifyingPaymsaterFactoryAddress() {
    return await getDeployed("VerifyingPaymasterFactory");
}

async function getVerifyingPaymsaterAddress() {
    return await getDeployed("VerifyingPaymaster");
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

async function getAccountFactoryAddress() {
    return await getDeployed("AccountFactory");
}

module.exports = {
    isDeployed,
    setDeployed,
    getDeployed,
    getHasherAddress,
    getRegistryAddress,
    getRegisterVerifierAddress,
    getRunnerFactoryAddress,
    getRandomRunnerAddress,
    getFirstRunnerAddress,
    getAccountFactoryAddress,
    getVerifyingPaymsaterAddress,
    getVerifyingPaymsaterFactoryAddress
};