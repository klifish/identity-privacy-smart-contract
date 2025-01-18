const fs = require("fs");

const registerPlonkVerifierPath = "contracts/RegisterPlonkVerifier.sol"; 
let registerPlonkVerifierContent = fs.readFileSync(registerPlonkVerifierPath, "utf8");
const registerPlonkVerifierName = "RegisterPlonkVerifier";
registerPlonkVerifierContent = registerPlonkVerifierContent.replace(/contract\s+\w+\s+{/g, `contract ${registerPlonkVerifierName} {`);
fs.writeFileSync(registerPlonkVerifierPath, registerPlonkVerifierContent, "utf8");
console.log(`Updated contract name to: ${registerPlonkVerifierName}`);


// const filePath = "contracts/RegisterPlonkVerifier.sol"; // 导出的 Solidity 文件路径
// const newName = "RegisterPlonkVerifier"; // 新的智能合约名称

// // 读取文件内容
// let content = fs.readFileSync(filePath, "utf8");

// // 替换合约名称
// content = content.replace(/contract\s+\w+\s+{/g, `contract ${newName} {`);

// // 保存修改后的文件
// fs.writeFileSync(filePath, content, "utf8");

// console.log(`Updated contract name to: ${newName}`);