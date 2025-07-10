#!/usr/bin/env node

import { execSync } from 'child_process';

// Parse arguments
const args = process.argv.slice(2);
let port = 3000; // default port

// Look for --port=XXXX, --port XXXX, -p=XXXX, or -p XXXX
args.forEach((arg, index) => {
  if (arg.startsWith('--port=')) {
    port = arg.split('=')[1];
  } else if (arg === '--port' && args[index + 1]) {
    port = args[index + 1];
  } else if (arg.startsWith('-p=')) {
    port = arg.split('=')[1];
  } else if (arg === '-p' && args[index + 1]) {
    port = args[index + 1];
  }
});

try {
  console.log(`Checking for processes on port ${port}...`);
  
  // Find processes using the port
  const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
  
  if (pids) {
    console.log(`Found processes: ${pids.replace(/\n/g, ', ')}`);
    
    // Kill the processes
    execSync(`kill -9 ${pids.replace(/\n/g, ' ')}`);
    console.log(`✓ Processes on port ${port} have been terminated`);
  } else {
    console.log(`No processes found on port ${port}`);
  }
} catch (error) {
  if (error.status === 1) {
    // lsof returns status 1 when no processes found
    console.log(`No processes found on port ${port}`);
  } else {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}