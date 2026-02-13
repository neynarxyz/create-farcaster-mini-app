# Contract Bytecode Verification

This directory contains a utility script for verifying smart contract bytecode by generating checksums and Solidity source code from deployed contracts.

## Overview

The `verify-contract.js` script fetches bytecode from a deployed smart contract and generates:
1. A Solidity source file (`VerifiedContract.sol`) with the bytecode embedded
2. A JSON file (`contract-verification.json`) with detailed verification data
3. SHA256 and Keccak256 checksums for bytecode verification

## Target Contracts

### Default Contract
**Address:** `0x93fb4459F48f379BA865eb55dDDc292C702ff569`

### Contract Creator Example
**Address:** `0x5A527BfA1F3038A2f35E58Bd2389Df89f1B52f3C`

This is an example of a contract creator address that can be verified using the tool. According to Etherscan's decompiler, this contract contains a payable fallback function.

The script attempts to locate contracts on multiple chains:
- Ethereum Mainnet
- Base
- Optimism
- Polygon
- Arbitrum
- BSC (Binance Smart Chain)
- Avalanche

## Installation

Navigate to the scripts directory and install dependencies:

```bash
cd scripts
npm install
```

## Usage

Run the verification script:

```bash
cd scripts
node verify-contract.js [contract-address] [--demo]
```

**Arguments:**
- `contract-address` (optional): The contract address to verify (default: 0x93fb4459F48f379BA865eb55dDDc292C702ff569)
- `--demo` (optional): Generate verification with sample bytecode if contract not found (otherwise exits with error)

**Examples:**
```bash
# Verify the default contract address
node verify-contract.js

# Verify a custom contract address
node verify-contract.js 0x1234567890abcdef1234567890abcdef12345678

# Verify the contract creator example
node verify-contract.js 0x5A527BfA1F3038A2f35E58Bd2389Df89f1B52f3C

# Use demo mode if contract not found
node verify-contract.js --demo
```

The script will:
1. Search for the contract across multiple blockchain networks
2. Fetch the deployed bytecode
3. Disassemble the bytecode into opcodes
4. Generate checksums (SHA256 and Keccak256)
5. Create a Solidity source file with embedded verification data
6. Save detailed information to a JSON file

**Note:** Without the `--demo` flag, the script will exit with an error if the contract is not found on any checked network.

## Output Files

All generated files are created in the `scripts/` directory:

### VerifiedContract.sol
A Solidity contract containing:
- Contract metadata (address, chain, bytecode length, checksums)
- Both Keccak256 and SHA256 checksums
- The original bytecode stored as a constant (if under 20KB)
- Verification functions using Keccak256 for on-chain verification
- Opcode summary in comments

**Note:** For large contracts (>20KB), only checksums are embedded to avoid exceeding EIP-170 deployment limits.

### contract-verification.json
A JSON file containing:
- Contract address
- Blockchain network
- Complete bytecode
- SHA256 and Keccak256 checksums
- Full opcode disassembly
- Timestamp

## Verification Process

To verify the bytecode:

1. **Compare Checksums:**
   ```
   SHA256: <checksum from contract-verification.json>
   Keccak256: <checksum from contract-verification.json>
   ```

2. **Use the Solidity Contract:**
   - Deploy `VerifiedContract.sol` 
   - Call `verifyBytecode()` with candidate bytecode
   - Check `getBytecodeChecksum()` to get the expected checksum

3. **Manual Verification:**
   - Compare the bytecode from the JSON file with the on-chain bytecode
   - Use a blockchain explorer (Etherscan, Basescan, etc.)

## Example Output

```
Contract Bytecode Verification Tool
====================================

Target Contract: 0x93fb4459F48f379BA865eb55dDDc292C702ff569

Checking Ethereum Mainnet...
✓ Contract found on Ethereum Mainnet!

Bytecode Length: 1234 bytes
SHA256 Checksum: abc123...

Total Opcodes: 456

First 10 opcodes:
  0: PUSH1 0x80
  1: PUSH1 0x40
  2: MSTORE
  ...

✓ Solidity source generated: ./VerifiedContract.sol
✓ Detailed information saved: ./contract-verification.json

✓ Verification complete!
```

## Notes

- If the contract is not found on any of the predefined chains, the script will generate a sample verification using demo bytecode
- The script can be extended to support additional blockchain networks by adding them to the `CHAINS` array
- For custom RPC endpoints, modify the `CHAINS` configuration in the script

## Analyzing Decompiled Contracts

### Understanding Fallback Functions

When verifying contracts with fallback functions (like `0x5A527BfA1F3038A2f35E58Bd2389Df89f1B52f3C`), the decompiler may show:

```
() payable # default function
defined as _fallback
```

**Common Patterns:**

1. **Calldata Size Checks:**
   ```solidity
   require calldata.size < 4
   ```
   This prevents function calls (selectors are 4 bytes) while allowing ETH transfers.

2. **Empty Calldata Requirements:**
   ```solidity
   require not calldata.size
   ```
   This only accepts plain ETH transfers with no data.

### Bytecode Pattern Recognition

The verification script recognizes common patterns:

- **CALLDATASIZE checks**: Identifies fallback function restrictions
- **Function selectors**: Detects standard function patterns
- **Proxy patterns**: Recognizes DELEGATECALL usage
- **Storage access**: Identifies SLOAD/SSTORE patterns

For detailed analysis of specific patterns, see [CONTRACT_0x5A527BfA_ANALYSIS.md](./CONTRACT_0x5A527BfA_ANALYSIS.md).

## Opcodes

The script includes a basic opcode disassembler that converts bytecode into human-readable EVM opcodes. The opcodes are displayed in the console output and embedded in the generated Solidity source file.

## Technical Details

- **Viem**: Used for blockchain interaction
- **Crypto**: Node.js crypto module for SHA256 hashing
- **Opcode Disassembly**: Custom implementation supporting common EVM opcodes

## Troubleshooting

**Contract not found:**
- Verify the contract address is correct
- The contract may be on a network not included in the default chains
- Add custom RPC endpoints to the `CHAINS` array

**RPC errors:**
- Some public RPC endpoints may have rate limits
- Consider using your own RPC endpoint (Infura, Alchemy, etc.)

## License

MIT
