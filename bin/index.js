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

const REPO_URL = 'https://github.com/neynarxyz/create-neynar-farcaster-frame.git';
const SCRIPT_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

function printWelcomeMessage() {
  const purple = '\x1b[35m';
  const blue = '\x1b[34m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const bright = '\x1b[1m';

  console.log(`
${purple}╔═══════════════════════════════════════════════════╗${reset}
${purple}║                                                   ║${reset}
${purple}║${reset}     ${bright}Welcome to Frames v2 Quickstart by Neynar${reset}     ${purple}║${reset}
${purple}║${reset}     ${dim}The fastest way to build Farcaster Frames${reset}     ${purple}║${reset}
${purple}║                                                   ║${reset}
${purple}╚═══════════════════════════════════════════════════╝${reset}

${blue}Version:${reset} ${SCRIPT_VERSION}
${blue}Repository:${reset} ${dim}${REPO_URL}${reset}

Let's create your Frame! 🚀
`);
}

async function queryNeynarApp(apiKey) {
  if (!apiKey) {
    return null;
  }
  try {
    const response = await fetch(
      `https://api.neynar.com/portal/app_by_api_key`,
      {
        headers: {
          'x-api-key': apiKey
        }
      }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error querying Neynar app data:', error);
    return null;
  }
}

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
  printWelcomeMessage();

  // Ask about Neynar usage
  let useNeynar = true;
  let neynarApiKey = null;
  let neynarClientId = null;
  let neynarAppName = null;
  let neynarAppLogoUrl = null;

  while (useNeynar) {
    const neynarAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useNeynar',
        message: '🪐 Neynar is an API that makes it easy to build on Farcaster.\n\nBenefits of using Neynar in your frame:\n- Pre-configured webhook handling (no setup required)\n- Automatic frame analytics in your dev portal\n- Send manual notifications from dev.neynar.com\n- Built-in rate limiting and error handling\n\nWould you like to use Neynar in your frame?',
        default: true
      }
    ]);

    if (!neynarAnswers.useNeynar) {
      useNeynar = false;
      break;
    }

    const neynarKeyAnswer = await inquirer.prompt([
      {
        type: 'password',
        name: 'neynarApiKey',
        message: 'Enter your Neynar API key (or press enter to skip):',
        default: null
      }
    ]);

    if (neynarKeyAnswer.neynarApiKey) {
      neynarApiKey = neynarKeyAnswer.neynarApiKey;
    } else {
      const useDemoKey = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useDemo',
          message: 'Would you like to try the demo Neynar API key?',
          default: true
        }
      ]);
      neynarApiKey = useDemoKey.useDemo ? 'FARCASTER_V2_FRAMES_DEMO' : null;
    }

    if (!neynarApiKey) {
      console.log('\n⚠️  No valid API key provided. Would you like to try again?');
      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Try configuring Neynar again?',
          default: true
        }
      ]);
      if (!retry) {
        useNeynar = false;
        break;
      }
      continue;
    }

    const appInfo = await queryNeynarApp(neynarApiKey);
    if (appInfo) {
      neynarClientId = appInfo.app_uuid;
      neynarAppName = appInfo.app_name;
      neynarAppLogoUrl = appInfo.logo_url;
    }

    if (!neynarClientId) {
      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: '⚠️  Could not find a client ID for this API key. Would you like to try configuring Neynar again?',
          default: true
        }
      ]);
      if (!retry) {
        useNeynar = false;
        break;
      }
      continue;
    }

    // If we get here, we have both API key and client ID
    break;
  }

  const defaultFrameName = neynarAppName.toLowerCase().includes('demo') ? undefined : neynarAppName;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: '⚠️ Note: choosing a longer, more unique project name will help avoid conflicts with other existing domains\nWhat is the name of your frame?',
      default: defaultFrameName,
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
    }
  ]);

  // Ask about localhost vs tunnel
  const hostingAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useTunnel',
      message: 'Would you like to use a tunnel for development?\n\n' +
        'Using a tunnel:\n' +
        '- No sudo privileges required\n' +
        '- Works with all Warpcast Frame Developer Tools\n' +
        '- Possible to test on mobile devices\n\n' +
        'Using localhost:\n' +
        '- Requires sudo privileges to enable HTTPS\n' +
        '- Only works with the "Preview Frame" Warpcast tool\n' +
        '- Cannot test frame embeds or mobile devices\n\n' +
        'Note: You can always switch between localhost and tunnel by editing the USE_TUNNEL environment variable in .env.local\n\n' +
        'Use tunnel?',
      default: false
    }
  ]);
  answers.useTunnel = hostingAnswer.useTunnel;

  // Ask for seed phrase last
  const seedPhraseAnswer = await inquirer.prompt([
    {
      type: 'password',
      name: 'seedPhrase',
      message: 'Enter your Farcaster custody account seed phrase to generate a signed manifest for your frame\n(optional -- leave blank to create an unsigned frame)\n(seed phrase is only ever stored in .env.local)\n\nSeed phrase:',
      default: null
    }
  ]);
  answers.seedPhrase = seedPhraseAnswer.seedPhrase;

  let account;
  let custodyAddress;
  let fid;

  if (answers.seedPhrase) {
    let fidLookupSuccessful = false;
    while (!fidLookupSuccessful) {
      try {
        // Generate custody address from seed phrase
        account = mnemonicToAccount(answers.seedPhrase);
        custodyAddress = account.address;

        // Look up FID using custody address
        console.log('\nUsing seed phrase to look up FID by custody address...');
        fid = await lookupFidByCustodyAddress(custodyAddress, neynarApiKey ?? 'FARCASTER_V2_FRAMES_DEMO');
        
        if (!fid) {
          throw new Error('No FID found for this custody address');
        }
        
        fidLookupSuccessful = true;
        console.log(`\n✅ Successfully found FID ${fid} for custody address ${custodyAddress}`);
      } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n⚠️  Could not find an FID for this seed phrase. This usually means:');
        console.log('1. The seed phrase might be incorrect');
        console.log('2. The account might not be registered on Farcaster');
        console.log('3. The custody address might not be linked to a Farcaster account\n');

        // Ask for seed phrase again
        const retryAnswer = await inquirer.prompt([
          {
            type: 'password',
            name: 'seedPhrase',
            message: 'Please enter your seed phrase again (or leave empty to continue without signing):\n',
            default: null
          }
        ]);

        if (!retryAnswer.seedPhrase) {
          console.log('\n⚠️  Continuing without frame signing...');
          break;
        }
        answers.seedPhrase = retryAnswer.seedPhrase;
      }
    }
  }

  const projectName = answers.projectName;
  const projectDirName = projectName.replace(/\s+/g, '-').toLowerCase();
  const projectPath = path.join(process.cwd(), projectDirName);

  console.log(`\nCreating a new Frames v2 app in ${projectPath}`);

  // Clone the repository
  try {
    console.log(`\nCloning repository from ${REPO_URL}...`);
    // Use separate commands for better cross-platform compatibility
    execSync(`git clone ${REPO_URL} "${projectPath}"`, { stdio: 'inherit' });
    execSync('git fetch origin main', { cwd: projectPath, stdio: 'inherit' });
    execSync('git reset --hard origin/main', { cwd: projectPath, stdio: 'inherit' });
  } catch (error) {
    console.error('\n❌ Error: Failed to create project directory.');
    console.error('Please make sure you have write permissions and try again.');
    process.exit(1);
  }

  // Remove the .git directory
  console.log('\nRemoving .git directory...');
  fs.rmSync(path.join(projectPath, '.git'), { recursive: true, force: true });

  // Remove package-lock.json
  console.log('\nRemoving package-lock.json...');
  const packageLockPath = path.join(projectPath, 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    fs.unlinkSync(packageLockPath);
  }

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
  delete packageJson.dependencies;
  delete packageJson.devDependencies;

  // Add dependencies
  packageJson.dependencies = {
    "@farcaster/auth-kit": "^0.6.0",
    "@farcaster/frame-core": "^0.0.29", 
    "@farcaster/frame-node": "^0.0.18",
    "@farcaster/frame-sdk": "^0.0.31",
    "@farcaster/frame-wagmi-connector": "^0.0.19",
    "@radix-ui/react-label": "^2.1.1",
    "@tanstack/react-query": "^5.61.0",
    "@upstash/redis": "^1.34.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dotenv": "^16.4.7",
    "lucide-react": "^0.469.0",
    "next": "15.0.3",
    "next-auth": "^4.24.11",
    "react": "^18",
    "react-dom": "^18",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "viem": "^2.23.6",
    "wagmi": "^2.14.12"
  };

  packageJson.devDependencies = {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "crypto": "^1.0.1",
    "eslint": "^8",
    "eslint-config-next": "15.0.3",
    "localtunnel": "^2.0.2",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  };

  // Add Neynar dependencies if selected
  if (useNeynar) {
    packageJson.dependencies['@neynar/nodejs-sdk'] = '^2.19.0';
    packageJson.dependencies['@neynar/react'] = '^0.9.7';
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Handle .env file
  console.log('\nSetting up environment variables...');
  const envExamplePath = path.join(projectPath, '.env.example');
  const envPath = path.join(projectPath, '.env.local');
  if (fs.existsSync(envExamplePath)) {
    // Read the example file content
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    // Write it to .env.local
    fs.writeFileSync(envPath, envExampleContent);
    
    // Generate custody address from seed phrase
    if (answers.seedPhrase) {
      const account = mnemonicToAccount(answers.seedPhrase);
      const custodyAddress = account.address;

      // Look up FID using custody address
      if (!fid) {
        console.log('\nLooking up FID...');
        fid = await lookupFidByCustodyAddress(custodyAddress, neynarApiKey ?? 'FARCASTER_V2_FRAMES_DEMO');
      }

      // Write seed phrase and FID to .env.local for manifest signature generation
      fs.appendFileSync(envPath, `\nSEED_PHRASE="${answers.seedPhrase}"`);
      fs.appendFileSync(envPath, `\nFID="${fid}"`);
    }

    // Append all remaining environment variables
    fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_NAME="${answers.projectName}"`);
    fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_DESCRIPTION="${answers.description}"`);
    fs.appendFileSync(envPath, `\nNEXT_PUBLIC_FRAME_BUTTON_TEXT="${answers.buttonText}"`);
    if (useNeynar) {
      fs.appendFileSync(envPath, `\nNEYNAR_API_KEY="${neynarApiKey}"`);
      fs.appendFileSync(envPath, `\nNEYNAR_CLIENT_ID="${neynarClientId}"`);
    }
    fs.appendFileSync(envPath, `\nUSE_TUNNEL="${answers.useTunnel}"`);
    
    fs.unlinkSync(envExamplePath);
    console.log('\nCreated .env.local file from .env.example');
  } else {
    console.log('\n.env.example does not exist, skipping copy and remove operations');
  }

  // Update README
  console.log('\nUpdating README...');
  const readmePath = path.join(projectPath, 'README.md');
  const prependText = `<!-- generated by create-neynar-farcaster-frame version ${SCRIPT_VERSION} -->\n\n`;
  if (fs.existsSync(readmePath)) {
    const originalReadmeContent = fs.readFileSync(readmePath, { encoding: 'utf8' });
    const updatedReadmeContent = prependText + originalReadmeContent;
    fs.writeFileSync(readmePath, updatedReadmeContent);
  } else {
    fs.writeFileSync(readmePath, prependText);
  }

  // Install dependencies
  console.log('\nInstalling dependencies...');

  execSync('npm cache clean --force', { cwd: projectPath, stdio: 'inherit' });
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
  execSync('git commit -m "initial commit from create-neynar-farcaster-frame"', { cwd: projectPath });

  // Calculate border length based on message length
  const message = `✨🪐 Successfully created frame ${projectName} with git and dependencies installed! 🪐✨`;
  const borderLength = message.length;
  const borderStars = '✨'.repeat((borderLength / 2) + 1);

  console.log(`\n${borderStars}`);
  console.log(`${message}`);
  console.log(`${borderStars}`);
  console.log('\nTo run the app:');
  console.log(`  cd ${projectName}`);
  console.log('  npm run dev\n');
}

init().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
