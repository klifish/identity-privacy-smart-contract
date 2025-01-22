require('dotenv').config();
const { exec } = require('child_process');

const key = process.env.THIRDWEB_KEY;
console.log('Deploying with THIRDWEB_KEY:', key);
if (!key) {
    console.error('Error: THIRDWEB_KEY is not set in .env file');
    process.exit(1);
}

const command = `npx thirdweb@latest deploy -k ${key} -f contracts/MyContract.sol`;
exec(command, (err, stdout, stderr) => {
    if (err) {
        console.error(`Error: ${stderr}`);
        return;
    }
    console.log(stdout);
});