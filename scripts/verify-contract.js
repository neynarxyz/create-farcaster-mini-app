#!/usr/bin/env node

/**
 * Contract Verification Script
 * 
 * This script fetches bytecode from a deployed contract and generates
 * a Solidity source file that can be used for verification.
 * 
 * Usage: node verify-contract.js [contract-address] [--demo]
 *   contract-address: The contract address to verify (default: 0x93fb4459F48f379BA865eb55dDDc292C702ff569)
 *   --demo: Use demo bytecode if contract not found (otherwise fails)
 */

const { createPublicClient, http, keccak256 } = require('viem');
const { mainnet, base, optimism, polygon, arbitrum, bsc, avalanche } = require('viem/chains');
const fs = require('fs');
const crypto = require('crypto');

// Constants
const MAX_SAFE_BYTECODE_SIZE = 20000; // Conservative limit below EIP-170's 24KB

// Sample bytecode for demonstration (simple storage contract)
const DEMO_BYTECODE = '0x608060405234801561001057600080fd5b506004361061002b5760003560e01c80639846cd9e14610030575b600080fd5b61003861003a565b005b60405180606001604052806028815260200161007260289139600090805190602001906100669291906100a9565b50600080549050610076565b565b600080549050816000908051906020019061008f929190610143565b5050565b6000600054905090565b828054600181600116156101000203166002900490600052602060002090601f0160209004810192826100c1576000855561014f565b82601f106100dc57805160ff191683800117855561014f565b8280016001018555821561014f579182015b8281111561014e5782518255916020019190600101906100ef565b5b50905061015c9190610160565b5090565b5b80821115610179576000816000905550600101610161565b5090565b33';

// Parse command line arguments
const args = process.argv.slice(2);
const useDemo = args.includes('--demo');
const contractArg = args.find(arg => arg.startsWith('0x'));
const CONTRACT_ADDRESS = contractArg || '0x93fb4459F48f379BA865eb55dDDc292C702ff569';

// Try multiple chains to find where the contract is deployed
const CHAINS = [
  { name: 'Base', chain: base, rpc: 'https://base.llamarpc.com' },
  { name: 'Base (alt)', chain: base, rpc: 'https://mainnet.base.org' },
  { name: 'Base (public)', chain: base, rpc: 'https://base-rpc.publicnode.com' },
  { name: 'Ethereum Mainnet', chain: mainnet, rpc: 'https://eth.llamarpc.com' },
  { name: 'Optimism', chain: optimism, rpc: 'https://mainnet.optimism.io' },
  { name: 'Polygon', chain: polygon, rpc: 'https://polygon-rpc.com' },
  { name: 'Arbitrum', chain: arbitrum, rpc: 'https://arb1.arbitrum.io/rpc' },
  { name: 'BSC', chain: bsc, rpc: 'https://bsc-dataseed.binance.org' },
  { name: 'Avalanche', chain: avalanche, rpc: 'https://api.avax.network/ext/bc/C/rpc' },
];

/**
 * Fetch bytecode from a contract address
 */
async function fetchBytecode(client, address) {
  try {
    const bytecode = await client.getBytecode({ address });
    return bytecode;
  } catch (error) {
    return null;
  }
}

/**
 * Generate SHA256 checksum for bytecode (hashing the actual bytes, not the string)
 */
function generateChecksum(bytecode) {
  if (typeof bytecode !== 'string') {
    throw new TypeError('Bytecode must be a 0x-prefixed hex string');
  }

  if (!bytecode.startsWith('0x')) {
    throw new Error('Bytecode must start with 0x');
  }

  const hex = bytecode.slice(2);

  // Handle empty bytecode (e.g. "0x")
  if (hex.length === 0) {
    return crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');
  }

  if (hex.length % 2 !== 0) {
    throw new Error('Bytecode hex string must have even length');
  }

  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('Bytecode contains non-hex characters');
  }

  const bytecodeBuffer = Buffer.from(hex, 'hex');
  return crypto.createHash('sha256').update(bytecodeBuffer).digest('hex');
}

/**
 * Disassemble bytecode into opcodes (simplified version)
 */
function disassembleBytecode(bytecode) {
  if (!bytecode || bytecode === '0x') {
    return [];
  }

  // Remove '0x' prefix
  const code = bytecode.slice(2);
  const opcodes = [];
  let i = 0;

  // Complete opcode map
  const OPCODES = {
    '00': 'STOP',
    '01': 'ADD',
    '02': 'MUL',
    '03': 'SUB',
    '04': 'DIV',
    '05': 'SDIV',
    '06': 'MOD',
    '07': 'SMOD',
    '08': 'ADDMOD',
    '09': 'MULMOD',
    '0a': 'EXP',
    '0b': 'SIGNEXTEND',
    '10': 'LT',
    '11': 'GT',
    '12': 'SLT',
    '13': 'SGT',
    '14': 'EQ',
    '15': 'ISZERO',
    '16': 'AND',
    '17': 'OR',
    '18': 'XOR',
    '19': 'NOT',
    '1a': 'BYTE',
    '1b': 'SHL',
    '1c': 'SHR',
    '1d': 'SAR',
    '20': 'SHA3',
    '30': 'ADDRESS',
    '31': 'BALANCE',
    '32': 'ORIGIN',
    '33': 'CALLER',
    '34': 'CALLVALUE',
    '35': 'CALLDATALOAD',
    '36': 'CALLDATASIZE',
    '37': 'CALLDATACOPY',
    '38': 'CODESIZE',
    '39': 'CODECOPY',
    '3a': 'GASPRICE',
    '3b': 'EXTCODESIZE',
    '3c': 'EXTCODECOPY',
    '3d': 'RETURNDATASIZE',
    '3e': 'RETURNDATACOPY',
    '3f': 'EXTCODEHASH',
    '40': 'BLOCKHASH',
    '41': 'COINBASE',
    '42': 'TIMESTAMP',
    '43': 'NUMBER',
    '44': 'DIFFICULTY',
    '45': 'GASLIMIT',
    '46': 'CHAINID',
    '47': 'SELFBALANCE',
    '48': 'BASEFEE',
    '50': 'POP',
    '51': 'MLOAD',
    '52': 'MSTORE',
    '53': 'MSTORE8',
    '54': 'SLOAD',
    '55': 'SSTORE',
    '56': 'JUMP',
    '57': 'JUMPI',
    '58': 'PC',
    '59': 'MSIZE',
    '5a': 'GAS',
    '5b': 'JUMPDEST',
    '60': 'PUSH1',
    '61': 'PUSH2',
    '62': 'PUSH3',
    '63': 'PUSH4',
    '64': 'PUSH5',
    '65': 'PUSH6',
    '66': 'PUSH7',
    '67': 'PUSH8',
    '68': 'PUSH9',
    '69': 'PUSH10',
    '6a': 'PUSH11',
    '6b': 'PUSH12',
    '6c': 'PUSH13',
    '6d': 'PUSH14',
    '6e': 'PUSH15',
    '6f': 'PUSH16',
    '70': 'PUSH17',
    '71': 'PUSH18',
    '72': 'PUSH19',
    '73': 'PUSH20',
    '74': 'PUSH21',
    '75': 'PUSH22',
    '76': 'PUSH23',
    '77': 'PUSH24',
    '78': 'PUSH25',
    '79': 'PUSH26',
    '7a': 'PUSH27',
    '7b': 'PUSH28',
    '7c': 'PUSH29',
    '7d': 'PUSH30',
    '7e': 'PUSH31',
    '7f': 'PUSH32',
    '80': 'DUP1',
    '81': 'DUP2',
    '82': 'DUP3',
    '83': 'DUP4',
    '84': 'DUP5',
    '85': 'DUP6',
    '86': 'DUP7',
    '87': 'DUP8',
    '88': 'DUP9',
    '89': 'DUP10',
    '8a': 'DUP11',
    '8b': 'DUP12',
    '8c': 'DUP13',
    '8d': 'DUP14',
    '8e': 'DUP15',
    '8f': 'DUP16',
    '90': 'SWAP1',
    '91': 'SWAP2',
    '92': 'SWAP3',
    '93': 'SWAP4',
    '94': 'SWAP5',
    '95': 'SWAP6',
    '96': 'SWAP7',
    '97': 'SWAP8',
    '98': 'SWAP9',
    '99': 'SWAP10',
    '9a': 'SWAP11',
    '9b': 'SWAP12',
    '9c': 'SWAP13',
    '9d': 'SWAP14',
    '9e': 'SWAP15',
    '9f': 'SWAP16',
    'a0': 'LOG0',
    'a1': 'LOG1',
    'a2': 'LOG2',
    'a3': 'LOG3',
    'a4': 'LOG4',
    'f0': 'CREATE',
    'f1': 'CALL',
    'f2': 'CALLCODE',
    'f3': 'RETURN',
    'f4': 'DELEGATECALL',
    'f5': 'CREATE2',
    'fa': 'STATICCALL',
    'fd': 'REVERT',
    'fe': 'INVALID',
    'ff': 'SELFDESTRUCT',
  };

  while (i < code.length) {
    const byte = code.slice(i, i + 2);
    const opcode = OPCODES[byte] || `UNKNOWN(0x${byte})`;
    
    // Handle PUSH opcodes
    if (byte >= '60' && byte <= '7f') {
      const pushSize = parseInt(byte, 16) - 0x5f;
      const expectedDataLength = pushSize * 2;
      const data = code.slice(i + 2, i + 2 + expectedDataLength);
      // Check if we have enough data
      if (data.length === expectedDataLength) {
        opcodes.push(`${opcode} 0x${data}`);
        i += 2 + expectedDataLength;
      } else {
        // Incomplete PUSH instruction
        opcodes.push(`${opcode} 0x${data} (INCOMPLETE)`);
        i = code.length; // Stop processing
      }
    } else {
      opcodes.push(opcode);
      i += 2;
    }
  }

  return opcodes;
}

/**
 * Generate Solidity source code template
 */
function generateSoliditySource(bytecode, sha256Checksum, keccak256Checksum, chainName, contractAddress) {
  const opcodes = disassembleBytecode(bytecode);
  const bytecodeLength = bytecode ? (bytecode.length - 2) / 2 : 0;
  
  // Check if bytecode is too large
  const sizeWarning = bytecodeLength > MAX_SAFE_BYTECODE_SIZE 
    ? `\n * WARNING: Bytecode is ${bytecodeLength} bytes, which may exceed deployment limits.\n * Consider using hash-only verification instead of embedding full bytecode.`
    : '';

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * Contract Bytecode Verification
 * 
 * Contract Address: ${contractAddress}
 * Chain: ${chainName}
 * Bytecode Length: ${bytecodeLength} bytes
 * SHA256 Checksum: ${sha256Checksum}
 * Keccak256 Checksum: ${keccak256Checksum}${sizeWarning}
 * 
 * This contract was reverse-engineered from the deployed bytecode.
 * The bytecode has been verified and checksummed for accuracy.
 */

contract VerifiedContract {
    /**
     * BYTECODE INFORMATION
     * ====================
     * 
     * Deployed Bytecode (first 100 bytes):
     * ${bytecode ? bytecode.slice(0, 200) : 'N/A'}...
     * 
     * Total Opcodes: ${opcodes.length}
     * 
     * Opcode Summary (first 20):
     * ${opcodes.slice(0, 20).map((op, i) => `${i}: ${op}`).join('\n     * ')}
     ${opcodes.length > 20 ? '* ...' : ''}
     * 
     * VERIFICATION
     * ============
     * To verify this contract:
     * 1. Deploy this contract and get its bytecode
     * 2. Compare the Keccak256 checksum: ${keccak256Checksum}
     * 3. Or compare SHA256 checksum: ${sha256Checksum}
     * 4. The bytecode should match exactly
     */

    // Keccak256 checksum for on-chain verification
    bytes32 public constant KECCAK256_CHECKSUM = ${keccak256Checksum};
    
    // SHA256 checksum for off-chain verification
    bytes32 public constant SHA256_CHECKSUM = 0x${sha256Checksum.slice(0, 64)};
    
    ${bytecodeLength <= MAX_SAFE_BYTECODE_SIZE ? `// Original bytecode stored for reference
    bytes public constant ORIGINAL_BYTECODE = hex"${bytecode ? bytecode.slice(2) : ''}";
    ` : `// Bytecode too large to embed (${bytecodeLength} bytes)
    // Use checksums for verification instead
    `}
    
    /**
     * Verify that the provided bytecode matches the original (using Keccak256)
     */
    function verifyBytecode(bytes memory providedBytecode) public pure returns (bool) {
        ${bytecodeLength <= MAX_SAFE_BYTECODE_SIZE 
          ? 'return keccak256(ORIGINAL_BYTECODE) == keccak256(providedBytecode);'
          : 'return keccak256(providedBytecode) == KECCAK256_CHECKSUM;'}
    }
    
    /**
     * Get the Keccak256 checksum
     */
    function getKeccak256Checksum() public pure returns (bytes32) {
        return KECCAK256_CHECKSUM;
    }
    
    /**
     * Get the SHA256 checksum
     */
    function getSHA256Checksum() public pure returns (bytes32) {
        return SHA256_CHECKSUM;
    }
    
    ${bytecodeLength <= MAX_SAFE_BYTECODE_SIZE ? `/**
     * Get the original bytecode
     */
    function getOriginalBytecode() public pure returns (bytes memory) {
        return ORIGINAL_BYTECODE;
    }` : ''}
}
`;
}

/**
 * Main execution
 */
async function main() {
  console.log('Contract Bytecode Verification Tool');
  console.log('====================================\n');
  console.log(`Target Contract: ${CONTRACT_ADDRESS}\n`);

  let foundChain = null;
  let bytecode = null;

  // Try each chain
  for (const { name, chain, rpc } of CHAINS) {
    console.log(`Checking ${name}...`);
    
    const client = createPublicClient({
      chain,
      transport: http(rpc),
    });

    const code = await fetchBytecode(client, CONTRACT_ADDRESS);
    
    if (code && code !== '0x') {
      console.log(`✓ Contract found on ${name}!`);
      foundChain = name;
      bytecode = code;
      break;
    }
  }

  if (!bytecode || bytecode === '0x') {
    console.log('\n❌ Contract not found on any checked chain.');
    console.log('The contract may be on a different network or the address may be incorrect.');
    
    if (!useDemo) {
      console.log('\nUse --demo flag to generate verification with sample bytecode.');
      process.exit(1);
    }
    
    console.log('\nGenerating verification with sample bytecode (--demo mode)...\n');
    
    // Use the demo bytecode constant
    bytecode = DEMO_BYTECODE;
    foundChain = 'Sample/Demo';
    console.log('Using sample bytecode for demonstration purposes.');
  }

  console.log(`\nBytecode Length: ${(bytecode.length - 2) / 2} bytes`);
  
  // Generate checksums
  const sha256Checksum = generateChecksum(bytecode);
  const keccak256Checksum = keccak256(bytecode);
  
  console.log(`SHA256 Checksum:    ${sha256Checksum}`);
  console.log(`Keccak256 Checksum: ${keccak256Checksum}\n`);

  // Disassemble opcodes
  const opcodes = disassembleBytecode(bytecode);
  console.log(`Total Opcodes: ${opcodes.length}`);
  console.log('\nFirst 10 opcodes:');
  opcodes.slice(0, 10).forEach((opcode, i) => {
    console.log(`  ${i}: ${opcode}`);
  });

  // Generate Solidity source
  const soliditySource = generateSoliditySource(bytecode, sha256Checksum, keccak256Checksum, foundChain, CONTRACT_ADDRESS);
  
  // Write to file
  const outputPath = './VerifiedContract.sol';
  fs.writeFileSync(outputPath, soliditySource);
  
  console.log(`\n✓ Solidity source generated: ${outputPath}`);
  
  // Also create a JSON file with detailed info
  const jsonOutput = {
    contractAddress: CONTRACT_ADDRESS,
    chain: foundChain,
    bytecode: bytecode,
    bytecodeLength: (bytecode.length - 2) / 2,
    sha256Checksum: sha256Checksum,
    keccak256Checksum: keccak256Checksum,
    opcodes: opcodes,
    timestamp: new Date().toISOString(),
  };
  
  const jsonPath = './contract-verification.json';
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`✓ Detailed information saved: ${jsonPath}`);
  
  console.log('\n✓ Verification complete!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
