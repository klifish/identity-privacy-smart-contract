/**
 * Type definitions for identity-privacy-sdk
 */

import { ethers } from 'ethers';

// ============ Configuration Types ============

export interface SDKConfig {
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Bundler endpoint URL */
  bundlerUrl?: string;
  /** Admin/signer private key */
  privateKey: string;
  /** Chain ID */
  chainId: number;
  /** Path to circuits build folder */
  circuitsPath?: string;
  /** Merkle tree depth */
  merkleTreeLevel?: number;
}

export interface ContractConfig {
  /** MyAccountFactory contract address */
  accountFactoryAddress: string;
  /** MerkleRegistry contract address */
  registryAddress: string;
  /** EntryPoint contract address */
  entryPointAddress?: string;
  /** VerifyingPaymaster contract address */
  paymasterAddress?: string;
  /** CommitmentVerifier contract address */
  commitmentVerifierAddress?: string;
}

// ============ Identity Module Types ============

export interface CreateAccountOptions {
  /** Salt value for deterministic address */
  salt?: number;
  /** Force creation even if already exists */
  force?: boolean;
  /** Counter ID for commitment */
  countId?: number;
}

export interface CreateAccountResult {
  /** Smart account address */
  address: string;
  /** Whether the account was newly deployed */
  deployed: boolean;
}

export interface RegisterUserResult {
  /** Whether registration succeeded */
  success: boolean;
  /** Merkle tree leaf value */
  leaf: bigint;
  /** Whether user was already registered */
  alreadyRegistered: boolean;
}

export declare class IdentityClient {
  constructor(config: SDKConfig & ContractConfig);

  /** Calculate Merkle tree leaf from credentials */
  calculateLeaf(secret: string, nullifier: bigint): Promise<bigint>;

  /** Get predicted smart account address */
  getSender(commitment: bigint | string, salt?: number): Promise<string>;

  /** Create a new smart account */
  createSmartAccount(secret: string, options?: CreateAccountOptions): Promise<CreateAccountResult>;

  /** Register user to Merkle tree with leaf value */
  registerUserWithLeaf(leaf: bigint): Promise<{ success: boolean; alreadyRegistered: boolean }>;

  /** Register user to Merkle tree */
  registerUser(
    secret: string,
    nullifier: bigint
  ): Promise<RegisterUserResult>;

  /** Check if a root is known in the registry */
  isKnownRoot(root: bigint): Promise<boolean>;

  /** Get all registered leaves from the registry */
  getRegisteredLeaves(): Promise<bigint[]>;
}

// ============ UserOp Module Types ============

export interface UserOperation {
  sender: string;
  nonce: number | bigint | string;
  initCode: string;
  callData: string;
  callGasLimit: number | bigint | string;
  verificationGasLimit: number | bigint | string;
  preVerificationGas: number | bigint | string;
  maxFeePerGas: number | bigint | string;
  maxPriorityFeePerGas: number | bigint | string;
  paymaster: string;
  paymasterData: string;
  paymasterVerificationGasLimit: number | bigint | string;
  paymasterPostOpGasLimit: number | bigint | string;
  signature: string;
}

export interface PackedUserOperation {
  sender: string;
  nonce: number | bigint | string;
  callData: string;
  accountGasLimits: string;
  initCode: string;
  preVerificationGas: number | bigint | string;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
}

export interface UserOpClientConfig {
  rpcUrl: string;
  bundlerUrl: string;
  entryPointAddress: string;
  chainId: number;
}

export declare class UserOpClient {
  constructor(config: UserOpClientConfig);

  /** Calculate UserOp hash */
  getUserOpHash(userOp: UserOperation): string;

  /** Pack a UserOperation */
  packUserOp(userOp: UserOperation): PackedUserOperation;

  /** Fill UserOp with defaults and estimate gas */
  fillUserOp(userOp: Partial<UserOperation>, getNonceFunction?: string): Promise<UserOperation>;

  /** Send UserOperation to bundler */
  sendUserOperation(userOp: UserOperation): Promise<{ result: string }>;

  /** Wait for UserOperation to be packed */
  waitForUserOperation(
    userOpHash: string,
    maxAttempts?: number,
    delayMs?: number
  ): Promise<string>;
}

export declare function fillUserOpDefaults(
  op: Partial<UserOperation>,
  defaults?: Partial<UserOperation>
): UserOperation;

export declare function packAccountGasLimits(
  verificationGasLimit: number | bigint,
  callGasLimit: number | bigint
): string;

export declare function packPaymasterData(
  paymaster: string,
  paymasterVerificationGasLimit: number | bigint,
  postOpGasLimit: number | bigint,
  paymasterData: string
): string;

export declare function packUserOp(userOp: UserOperation): PackedUserOperation;

export declare function getUserOpHash(
  op: UserOperation,
  entryPoint: string,
  chainId: number | bigint
): string;

export declare function getCallData(dest: string, value: number | bigint, func: string): string;

export declare function getDefaultUserOp(
  sender: string,
  paymaster: string,
  options?: { validUntil?: number; validAfter?: number }
): UserOperation;

// ============ ZKP Module Types ============

export interface ProofComponents {
  pA: string[];
  pB: string[][];
  pC: string[];
  pubSignals: string[];
}

export interface RegistrationProofParams {
  secret: string;
  nullifier: bigint;
  leaves: bigint[];
}

export interface ProofResult {
  proof: string;
  proofComponents: ProofComponents;
  publicInputs: string[];
  root?: bigint;
}

export declare class ZKPClient {
  constructor(config: { circuitsPath?: string; merkleTreeLevel?: number });

  /** Initialize the hasher for Merkle tree */
  initHasher(): Promise<{ hash: (left: bigint | string, right: bigint | string) => string }>;

  /** Calculate Merkle tree leaf from credentials */
  calculateLeaf(secret: string, nullifier: bigint): Promise<bigint>;

  /** Generate registration proof (Merkle tree membership) */
  generateRegistrationProof(params: RegistrationProofParams): Promise<ProofResult>;

  /** Generate commitment proof (for data access) */
  generateCommitmentProof(secret: string, domain?: string): Promise<ProofResult>;

  /** Verify proof locally using verification key */
  verifyProofLocally(
    proof: object,
    publicSignals: string[],
    circuitName: 'register' | 'commitment'
  ): Promise<boolean>;
}

export declare function generateRegistrationProof(
  config: { circuitsPath?: string },
  params: RegistrationProofParams
): Promise<ProofResult>;

export declare function generateCommitmentProof(
  config: { circuitsPath?: string },
  secret: string,
  domain?: string
): Promise<ProofResult>;

// ============ Contracts Module Types ============

export interface ContractAddressesConfig {
  deployedContractsPath?: string;
  addresses?: Record<string, string>;
}

export declare class ContractAddresses {
  constructor(config?: ContractAddressesConfig);

  /** Get a contract address */
  get(contractName: string): string | null;

  /** Get Hasher contract address */
  getHasher(): string | null;

  /** Get MerkleRegistry contract address */
  getRegistry(): string | null;

  /** Get RegisterVerifier contract address */
  getRegisterVerifier(): string | null;

  /** Get CommitmentVerifier contract address */
  getCommitmentVerifier(): string | null;

  /** Get RunnerFactory contract address */
  getRunnerFactory(): string | null;

  /** Get AccountFactory contract address */
  getAccountFactory(): string | null;

  /** Get VerifyingPaymaster contract address */
  getVerifyingPaymaster(): string | null;

  /** Get first Runner address */
  getFirstRunner(): string | null;

  /** Get all Runner addresses */
  getAllRunners(): string[];

  /** Get EntryPoint address (EIP-4337) */
  getEntryPoint(): string;

  /** Set a contract address (runtime override) */
  set(contractName: string, address: string): void;

  /** Get all addresses */
  getAll(): Record<string, string>;

  /** Clear cache */
  clearCache(): void;
}

export declare const ABIs: {
  MyAccountFactory: string[];
  MyAccount: string[];
  MerkleRegistry: string[];
  Runner: string[];
  VerifyingPaymaster: string[];
  UserData: string[];
  EntryPoint: string[];
};

export declare const POLYGON_AMOY_ADDRESSES: {
  entryPoint: string;
};

export declare function createContractAddresses(config?: ContractAddressesConfig): ContractAddresses;

// ============ Utils Module Types ============

export declare function initCrypto(): Promise<{ pedersen: any; babyjub: any }>;

export declare function pedersenHashMultipleInputs(
  inputs: Array<bigint | string | number>
): Promise<Uint8Array>;

export declare function computePedersenHash(message: string): Promise<bigint>;

export declare function bitsToNum(bits: number[]): bigint;

export declare function numToBits(inValue: bigint, n: number): number[];

export declare function address2Uint8Array32(address: string): Uint8Array;

export declare function p256(n: bigint | string | number): string;

export declare function groth16ExportSolidityCallData(
  proof: object,
  publicSignals: string[]
): Promise<ProofComponents>;

export declare function createProvider(rpcUrl: string): ethers.JsonRpcProvider;

export declare function createSigner(
  privateKey: string,
  provider: ethers.Provider
): ethers.Wallet;

// ============ Main Module Exports ============

declare const sdk: {
  identity: {
    IdentityClient: typeof IdentityClient;
    createSmartAccount: typeof IdentityClient.prototype.createSmartAccount;
    registerUser: typeof IdentityClient.prototype.registerUser;
    calculateLeaf: (
      secret: string,
      nullifier: bigint
    ) => Promise<bigint>;
  };
  userOp: {
    UserOpClient: typeof UserOpClient;
    fillUserOpDefaults: typeof fillUserOpDefaults;
    packAccountGasLimits: typeof packAccountGasLimits;
    packPaymasterData: typeof packPaymasterData;
    packUserOp: typeof packUserOp;
    getUserOpHash: typeof getUserOpHash;
    getCallData: typeof getCallData;
    getDefaultUserOp: typeof getDefaultUserOp;
  };
  zkp: {
    ZKPClient: typeof ZKPClient;
    generateRegistrationProof: typeof generateRegistrationProof;
    generateCommitmentProof: typeof generateCommitmentProof;
  };
  contracts: {
    ContractAddresses: typeof ContractAddresses;
    createContractAddresses: typeof createContractAddresses;
    ABIs: typeof ABIs;
    POLYGON_AMOY_ADDRESSES: typeof POLYGON_AMOY_ADDRESSES;
  };
  utils: {
    initCrypto: typeof initCrypto;
    pedersenHashMultipleInputs: typeof pedersenHashMultipleInputs;
    computePedersenHash: typeof computePedersenHash;
    bitsToNum: typeof bitsToNum;
    numToBits: typeof numToBits;
    address2Uint8Array32: typeof address2Uint8Array32;
    p256: typeof p256;
    groth16ExportSolidityCallData: typeof groth16ExportSolidityCallData;
    createProvider: typeof createProvider;
    createSigner: typeof createSigner;
  };

  // Convenience re-exports
  createSmartAccount: typeof IdentityClient.prototype.createSmartAccount;
  registerUser: typeof IdentityClient.prototype.registerUser;
  generateProof: typeof generateRegistrationProof;
};

export default sdk;
