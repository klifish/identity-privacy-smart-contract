const snarkjs = require("snarkjs");
const path = require('path');
const fs = require('fs');
const { downloadFile } = require('./downloadUtils');

const circuitsPath = __dirname + '/../build/circuits';
const contractsPath = __dirname + '/../build/contracts';

(
    async () => {
        try {
            const ptauUrl = "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau"
            const ptau_final = "powersOfTau28_hez_final_16.ptau";
            const ptau_path = path.resolve(__dirname, circuitsPath, ptau_final);

            if (!fs.existsSync(ptau_path)) {
                console.log(`Downloading ptau file ...`)
                await downloadFile({
                    url: ptauUrl,
                    path: ptau_path,
                })
            } else {
                console.log(`Ptau file already exists: ${ptau_path}, skipping download.`)
            }

            console.log('Groth16 setup...')
            const r1cs_file_register = "build/circuits/register.r1cs";
            await snarkjs.zKey.newZKey(r1cs_file_register, ptau_path, "build/circuits/register_0000.zkey", console);
            await snarkjs.zKey.contribute("build/circuits/register_0000.zkey", "build/circuits/register_0001.zkey", "1st Contributor Name", "1st Contributor Email", console);
            await snarkjs.zKey.contribute("build/circuits/register_0001.zkey", "build/circuits/register_final.zkey", "2nd Contributor Name", "2nd Contributor Email", console);

            const r1cs_file_commitment = "build/circuits/commitment.r1cs";
            await snarkjs.zKey.newZKey(r1cs_file_commitment, ptau_path, "build/circuits/commitment_0000.zkey", console);
            await snarkjs.zKey.contribute("build/circuits/commitment_0000.zkey", "build/circuits/commitment_0001.zkey", "1st Contributor Name", "1st Contributor Email", console);
            await snarkjs.zKey.contribute("build/circuits/commitment_0001.zkey", "build/circuits/commitment_final.zkey", "2nd Contributor Name", "2nd Contributor Email", console);


            console.log('Plonk setup...')
            await snarkjs.plonk.setup(r1cs_file_register, ptau_path, "build/circuits/register_final_plonk.zkey", console);
            await snarkjs.plonk.setup(r1cs_file_commitment, ptau_path, "build/circuits/commitment_final_plonk.zkey", console);

            process.exit(0);

        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    }
)();