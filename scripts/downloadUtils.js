const axios = require('axios');
const fs = require('fs');

/**
 * Download a file from a URL
 * @param {Object} params - Download parameters
 * @param {string} params.url - The URL to download from
 * @param {string} params.path - The local path to save the file
 * @returns {Promise<void>}
 */
async function downloadFile({ url, path }) {
    const writer = fs.createWriteStream(path);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

module.exports = { downloadFile };
