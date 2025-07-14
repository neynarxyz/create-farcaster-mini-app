#!/usr/bin/env node

import { init } from './init.js';

// Parse command line arguments
const args = process.argv.slice(2);
let projectName = null;
let autoAcceptDefaults = false;
let apiKey = null;

// Check for -y flag
const yIndex = args.indexOf('-y');
if (yIndex !== -1) {
  autoAcceptDefaults = true;
  args.splice(yIndex, 1); // Remove -y from args
}

  // Parse other arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-p' || arg === '--project') {
      if (i + 1 < args.length) {
        projectName = args[i + 1];
        if (projectName.startsWith('-')) {
          console.error('Error: Project name cannot start with a dash (-)');
          process.exit(1);
        }
        args.splice(i, 2); // Remove both the flag and its value
        i--; // Adjust index since we removed 2 elements
      } else {
        console.error('Error: -p/--project requires a project name');
        process.exit(1);
      }
    } else if (arg === '-k' || arg === '--api-key') {
      if (i + 1 < args.length) {
        apiKey = args[i + 1];
        if (apiKey.startsWith('-')) {
          console.error('Error: API key cannot start with a dash (-)');
          process.exit(1);
        }
        args.splice(i, 2); // Remove both the flag and its value
        i--; // Adjust index since we removed 2 elements
      } else {
        console.error('Error: -k/--api-key requires an API key');
        process.exit(1);
      }
    }
  }



// Validate that if -y is used, a project name must be provided
if (autoAcceptDefaults && !projectName) {
  console.error('Error: -y flag requires a project name. Use -p/--project to specify the project name.');
  process.exit(1);
}

init(projectName, autoAcceptDefaults, apiKey).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
