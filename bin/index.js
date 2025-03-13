#!/usr/bin/env node

import inquirer from 'inquirer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { mnemonicToAccount } from 'viem/accounts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_URL = 'https://github.com/lucas-neynar/frames-v2-quickstart.git';
const SCRIPT_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

async function lookupFidByCustodyAddress(custodyAddress, apiKey) {
  if (!apiKey) {
    throw new Error('Neynar API key is required');
  }

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/custody-address?custody_address=${custodyAddress}`,
    {
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to lookup FID: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.user?.fid) {
    throw new Error('No FID found for this custody address');
  }

  return data.user.fid;
}

async function init() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is the name of your frame?',
      validate: (input) => {
        if (input.trim() === '') {
          return 'Project name cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Give a one-line description of your frame:',
      validate: (input) => {
        if (input.trim() === '') {
          return 'Description cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'buttonText',
      message: 'Enter the button text for your frame:',
      default: 'Launch Frame',
      validate: (input) => {
        if (input.trim() === '') {
          return 'Button text cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'splashImageUrl',
      message: 'Enter the URL for your splash image\n(optional -- leave blank to use the default public/splash.png image or replace public/splash.png with your own)\n\nExternal splash image URL:',
      default: null
    },
    {
      type: 'input',
      name: 'iconImageUrl',
      message: 'Enter the URL for your app icon\n(optional -- leave blank to use the default public/icon.png image or replace public/icon.png with your own)\n\nExternal app icon URL:',
      default: null
    },
    {
      type: 'password',
      name: 'seedPhrase',
      message: 'Enter your Farcaster custody account seed phrase to generate a signed manifest for your frame\n(optional -- leave blank to create an unsigned frame)\n(seed phrase is only ever stored locally)\n\nSeed phrase:',
      default: null
    },
    {
      type: 'confirm',
      name: 'useNeynar',
      message: 'Would you like to use Neynar in your frame?',
      default: true
    }
  ]);

  // If using Neynar, ask for API key
  if (answers.useNeynar) {
    const neynarAnswers = await inquirer.prompt([
      {
        type: 'password',
        name: 'neynarApiKey',
        message: 'Enter your Neynar API key:',
        validate: (input) => {
          if (input.trim() === '') {
            return 'Neynar API key cannot be empty';
          }
          return true;
        }
      }
    ]);
    answers.neynarApiKey = neynarAnswers.neynarApiKey;
  }

  const projectName = answers.projectName;
  const projectPath = path.join(process.cwd(), projectName);

  console.log(`\nCreating a new Frames v2 app in ${projectPath}\n`);

  // Clone the repository
  try {
    execSync(`git clone ${REPO_URL} "${projectPath}"`);
  } catch (error) {
    console.error('\n❌ Error: Failed to create project directory.');
    console.error('Please make sure you have write permissions and try again.');
    process.exit(1);
  }

  // Remove the .git directory
  console.log('\nRemoving .git directory...');
  fs.rmSync(path.join(projectPath, '.git'), { recursive: true, force: true });

  // Update package.json
  console.log('\nUpdating package.json...');
  const packageJsonPath = path.join(projectPath, 'package.json');
  let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.name = projectName;
  packageJson.version = '0.1.0';
  delete packageJson.author;
  delete packageJson.keywords;
  delete packageJson.repository;
  delete packageJson.license;
  delete packageJson.bin;
  delete packageJson.files;

  // Add Neynar dependencies if selected
  if (answers.useNeynar) {
    packageJson.dependencies['@neynar/nodejs-sdk'] = '^2.19.0';
    packageJson.dependencies['@neynar/react'] = '^0.9.7';
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Handle .env file
  console.log('\nSetting up environment variables...');
  const envExamplePath = path.join(projectPath, '.env.example');
  const envPath = path.join(projectPath, '.env');
  if (fs.existsSync(envExamplePath)) {
    // Read the example file content
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    // Write it to .env
    fs.writeFileSync(envPath, envExampleContent);
    
    // Generate custody address from seed phrase
    if (answers.seedPhrase) {
      const account = mnemonicToAccount(answers.seedPhrase);
      const custodyAddress = account.address;

      // Look up FID using custody address
      console.log('\nLooking up FID...');
      const neynarApiKey = answers.useNeynar ? answers.neynarApiKey : 'FARCASTER_V2_FRAMES_DEMO';
      const fid = await lookupFidByCustodyAddress(custodyAddress, neynarApiKey);

      // Write seed phrase and FID to .env for manifest signature generation
      fs.appendFileSync(envPath, `\nSEED_PHRASE="${answers.seedPhrase}"`);
      fs.appendFileSync(envPath, `\nFID="${fid}"`);
    }

    if (answers.splashImageUrl) {
      fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL="${answers.splashImageUrl}"`);
    }

    if (answers.iconImageUrl) {
      fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_ICON_IMAGE_URL="${answers.iconImageUrl}"`);
    }

    // Append all remaining environment variables
    fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_NAME="${answers.projectName}"`);
    fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_DESCRIPTION="${answers.description}"`);
    fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_BUTTON_TEXT="${answers.buttonText}"`);
    fs.appendFileSync(envPath, `\nNEYNAR_API_KEY="${answers.useNeynar ? answers.neynarApiKey : 'FARCASTER_V2_FRAMES_DEMO'}"`);
    
    fs.unlinkSync(envExamplePath);
    console.log('\nCreated .env file from .env.example');
  } else {
    console.log('\n.env.example does not exist, skipping copy and remove operations');
  }

  // Update README
  console.log('\nUpdating README...');
  const readmePath = path.join(projectPath, 'README.md');
  const prependText = `<!-- generated by frames-v2-quickstart version ${SCRIPT_VERSION} -->\n\n`;
  if (fs.existsSync(readmePath)) {
    const originalReadmeContent = fs.readFileSync(readmePath, { encoding: 'utf8' });
    const updatedReadmeContent = prependText + originalReadmeContent;
    fs.writeFileSync(readmePath, updatedReadmeContent);
  } else {
    fs.writeFileSync(readmePath, prependText);
  }

  // Install dependencies
  console.log('\nInstalling dependencies...');
  execSync('npm install', { cwd: projectPath, stdio: 'inherit' });

  // Remove the bin directory
  console.log('\nRemoving bin directory...');
  const binPath = path.join(projectPath, 'bin');
  if (fs.existsSync(binPath)) {
    fs.rmSync(binPath, { recursive: true, force: true });
  }

  // Initialize git repository
  console.log('\nInitializing git repository...');
  execSync('git init', { cwd: projectPath });
  execSync('git add .', { cwd: projectPath });
  execSync('git commit -m "initial commit from frames-v2-quickstart"', { cwd: projectPath });

  console.log(`\n🪐✨ Successfully created frame ${projectName} with git and dependencies installed! ✨🪐`);
  console.log('\nTo run the app:');
  console.log(`  cd ${projectName}`);
  console.log('  npm run dev\n');
}

init().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
