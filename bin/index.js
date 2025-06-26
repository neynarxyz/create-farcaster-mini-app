#!/usr/bin/env node

import { init } from './init.js';

// Parse command line arguments
const args = process.argv.slice(2);
let projectName = null;
let autoAcceptDefaults = false;

// Check for -y flag
const yIndex = args.indexOf('-y');
if (yIndex !== -1) {
  autoAcceptDefaults = true;
  args.splice(yIndex, 1); // Remove -y from args
}

// If there's a remaining argument, it's the project name
if (args.length > 0) {
  projectName = args[0];
}

// If -y is used without project name, we still need to ask for project name
if (autoAcceptDefaults && !projectName) {
  // We'll handle this case in the init function by asking only for project name
  autoAcceptDefaults = false;
}

init(projectName, autoAcceptDefaults).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
