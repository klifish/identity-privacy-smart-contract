const { withdrawAllFromRunner } = require('./runnerInteraction');
const { getRandomRunnerAddress, getFirstRunnerAddress, getAccountFactoryAddress, getRunnerFactoryAddress } = require('./deploy/isDeployed');


async function main() {
    const runnerAddress = await getFirstRunnerAddress();
    await withdrawAllFromRunner(runnerAddress);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });