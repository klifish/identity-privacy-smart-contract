# Identity Privacy SDK

基于零知识证明和 EIP-4337 账户抽象的隐私身份管理 SDK。

## 安装

```bash
# 从 npm 安装 (发布后)
npm install identity-privacy-sdk

# 或从本地安装
npm install /path/to/identity-privacy-smart-contract

# 或使用 npm link (开发模式)
cd /path/to/identity-privacy-smart-contract
npm link

cd /path/to/your-project
npm link identity-privacy-sdk
```

## 快速开始

```javascript
const sdk = require('identity-privacy-sdk');

// 或导入单独模块
const { IdentityClient } = require('identity-privacy-sdk/identity');
const { UserOpClient } = require('identity-privacy-sdk/userOp');
const { ZKPClient } = require('identity-privacy-sdk/zkp');
```

## 模块说明

### 1. Identity 模块 - 身份管理

```javascript
const { IdentityClient } = require('identity-privacy-sdk/identity');

// 创建客户端
const identityClient = new IdentityClient({
  rpcUrl: 'https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY',
  privateKey: 'YOUR_PRIVATE_KEY',
  accountFactoryAddress: '0x...',
  registryAddress: '0x...',
});

// 创建智能账户
const result = await identityClient.createSmartAccount('my-secret', {
  salt: 1,
  countId: 0,
});
console.log('Smart Account:', result.address);

// 注册用户到 Merkle 树
const registerResult = await identityClient.registerUser(
  result.address,
  'my-secret',
  0n // nullifier
);
console.log('Registered, leaf:', registerResult.leaf);

// 获取所有已注册的叶子节点
const leaves = await identityClient.getRegisteredLeaves();
```

### 2. UserOp 模块 - EIP-4337 操作

```javascript
const { UserOpClient, getCallData, getDefaultUserOp } = require('identity-privacy-sdk/userOp');

// 创建客户端
const userOpClient = new UserOpClient({
  rpcUrl: 'https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY',
  bundlerUrl: 'https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY',
  entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  chainId: 80002,
});

// 创建默认 UserOperation
const userOp = getDefaultUserOp(senderAddress, paymasterAddress);

// 设置调用数据
const callData = getCallData(
  targetContract,
  0, // value
  encodedFunctionCall
);
userOp.callData = callData;

// 填充并估算 gas
const filledUserOp = await userOpClient.fillUserOp(userOp);

// 计算 hash
const hash = userOpClient.getUserOpHash(filledUserOp);

// 发送到 Bundler
const result = await userOpClient.sendUserOperation(filledUserOp);

// 等待打包
const txHash = await userOpClient.waitForUserOperation(result.result);
```

### 3. ZKP 模块 - 零知识证明

```javascript
const { ZKPClient } = require('identity-privacy-sdk/zkp');

// 创建客户端
const zkpClient = new ZKPClient({
  circuitsPath: '/path/to/build/circuits',
  merkleTreeLevel: 20,
});

// 生成注册证明 (Merkle 树成员资格证明)
const proof = await zkpClient.generateRegistrationProof({
  smartAccountAddress: '0x...',
  secret: 'my-secret',
  nullifier: 0n,
  leaves: [leaf1, leaf2, leaf3], // 所有已注册的叶子
});

console.log('Serialized proof:', proof.proof);
console.log('Merkle root:', proof.root);

// 生成承诺证明 (用于数据访问)
const commitmentProof = await zkpClient.generateCommitmentProof('my-secret', 'UserData');
```

### 4. Contracts 模块 - 合约地址管理

```javascript
const { ContractAddresses, ABIs } = require('identity-privacy-sdk/contracts');

// 从部署文件加载地址
const contracts = new ContractAddresses({
  deployedContractsPath: '/path/to/deployedContracts.json',
});

// 获取各种合约地址
const registry = contracts.getRegistry();
const accountFactory = contracts.getAccountFactory();
const paymaster = contracts.getVerifyingPaymaster();
const entryPoint = contracts.getEntryPoint();

// 手动设置地址
contracts.set('Registry', '0x...');

// 使用 ABI
const { ethers } = require('ethers');
const registryContract = new ethers.Contract(registry, ABIs.MerkleRegistry, provider);
```

### 5. Utils 模块 - 工具函数

```javascript
const {
  computePedersenHash,
  pedersenHashMultipleInputs,
  groth16ExportSolidityCallData,
  createProvider,
  createSigner,
} = require('identity-privacy-sdk/utils');

// 计算 Pedersen 哈希
const hash = await computePedersenHash('my-secret');

// 多输入哈希
const multiHash = await pedersenHashMultipleInputs([address, secret, nullifier]);

// 创建 provider 和 signer
const provider = createProvider('https://...');
const signer = createSigner('0x...privateKey', provider);
```

## 完整使用示例

### 创建智能账户并注册

```javascript
const sdk = require('identity-privacy-sdk');
const { ethers } = require('ethers');

async function main() {
  // 配置
  const config = {
    rpcUrl: process.env.API_URL,
    privateKey: process.env.PRIVATE_KEY,
    accountFactoryAddress: '0x...',
    registryAddress: '0x...',
  };

  // 1. 创建 Identity 客户端
  const identityClient = new sdk.identity.IdentityClient(config);

  // 2. 创建智能账户
  const secret = 'user-secret-phrase';
  const { address, deployed } = await identityClient.createSmartAccount(secret);
  console.log(`Smart account: ${address} (deployed: ${deployed})`);

  // 3. 注册到 Merkle 树
  const nullifier = 0n;
  const { leaf, alreadyRegistered } = await identityClient.registerUser(address, secret, nullifier);
  console.log(`Registered with leaf: ${leaf}`);

  // 4. 获取所有叶子用于生成证明
  const leaves = await identityClient.getRegisteredLeaves();

  // 5. 生成零知识证明
  const zkpClient = new sdk.zkp.ZKPClient({
    circuitsPath: './build/circuits',
  });

  const proof = await zkpClient.generateRegistrationProof({
    smartAccountAddress: address,
    secret,
    nullifier,
    leaves,
  });

  console.log('Proof generated:', proof.proof.slice(0, 50) + '...');
}

main().catch(console.error);
```

### 发送 UserOperation

```javascript
const sdk = require('identity-privacy-sdk');

async function sendUserOp() {
  const userOpClient = new sdk.userOp.UserOpClient({
    rpcUrl: process.env.API_URL,
    bundlerUrl: process.env.BUNDLER_URL,
    entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    chainId: 80002,
  });

  // 创建 UserOp
  const userOp = sdk.userOp.getDefaultUserOp(senderAddress, paymasterAddress);

  // 设置调用数据 (例如: 调用合约的 increment 函数)
  const iface = new ethers.Interface(['function increment()']);
  const funcData = iface.encodeFunctionData('increment');
  userOp.callData = sdk.userOp.getCallData(counterAddress, 0, funcData);

  // 设置签名 (ZKP proof)
  userOp.signature = zkProof;

  // 填充 gas 参数
  const filledOp = await userOpClient.fillUserOp(userOp);

  // 发送
  const result = await userOpClient.sendUserOperation(filledOp);
  console.log('UserOp hash:', result.result);

  // 等待确认
  const txHash = await userOpClient.waitForUserOperation(result.result);
  console.log('Transaction hash:', txHash);
}
```

## 发布到 NPM

```bash
# 1. 登录 npm
npm login

# 2. 更新版本号
npm version patch  # 或 minor, major

# 3. 发布
npm publish

# 4. 发布带 scope 的包 (如 @your-org/identity-privacy-sdk)
npm publish --access public
```

## 本地开发

```bash
# 在 SDK 目录
npm link

# 在使用 SDK 的项目目录
npm link identity-privacy-sdk

# 取消链接
npm unlink identity-privacy-sdk
```

## 测试

SDK 包含完整的单元测试，使用 Mocha 测试框架。

```bash
# 运行所有测试
npm test

# 运行单个模块测试
npm run test:utils       # 工具函数测试
npm run test:identity    # 身份模块测试
npm run test:userOp      # UserOperation 模块测试
npm run test:contracts   # 合约模块测试

# 运行测试覆盖率报告 (需要安装 nyc)
npm run test:coverage
```

### 测试结构

```
test/sdk/
├── utils.test.js      # 工具函数测试 (bitsToNum, computePedersenHash, etc.)
├── identity.test.js   # 身份模块测试 (calculateLeaf, IdentityClient)
├── userOp.test.js     # UserOp 测试 (packUserOp, getUserOpHash, etc.)
└── contracts.test.js  # 合约模块测试 (ContractAddresses, ABIs)
```

### 当前测试覆盖

- **Utils**: 位运算、Pedersen 哈希、地址转换等
- **Identity**: Merkle 叶子计算、客户端创建
- **UserOp**: UserOperation 打包、哈希计算、编码
- **Contracts**: 地址管理、ABI 验证

## API 参考

详细的 API 文档请参考 TypeScript 类型定义文件: `src/types/index.d.ts`

## 依赖

- `ethers` ^6.0.0 - 以太坊交互
- `snarkjs` ^0.7.5 - 零知识证明
- `circomlibjs` ^0.1.7 - Circom 密码学库
- `fixed-merkle-tree` ^0.7.3 - Merkle 树实现

## License

ISC
