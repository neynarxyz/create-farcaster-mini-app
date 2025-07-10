#!/usr/bin/env node

import inquirer from 'inquirer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_URL = 'https://github.com/neynarxyz/create-farcaster-mini-app.git';
const SCRIPT_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

// ANSI color codes
const purple = '\x1b[35m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';
const dim = '\x1b[2m';
const bright = '\x1b[1m';
const italic = '\x1b[3m';

function printWelcomeMessage() {
  console.log(`
${purple}╔═══════════════════════════════════════════════════╗${reset}
${purple}║                                                   ║${reset}
${purple}║${reset}         ${bright}Welcome to the Neynar Starter Kit${reset}         ${purple}║${reset}
${purple}║${reset}   ${dim}the quickest way to build Farcaster mini apps${reset}   ${purple}║${reset}
${purple}║                                                   ║${reset}
${purple}╚═══════════════════════════════════════════════════╝${reset}

${blue}Version:${reset} ${SCRIPT_VERSION}
${blue}Repository:${reset} ${dim}${REPO_URL}${reset}

Let's create your mini app! 🚀
`);
}

async function queryNeynarApp(apiKey) {
  if (!apiKey) {
    return null;
  }
  try {
    const response = await fetch(
      `https://api.neynar.com/portal/app_by_api_key?starter_kit=true`,
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

// Export the main CLI function for programmatic use
export async function init(projectName = null, autoAcceptDefaults = false) {
  printWelcomeMessage();

  // Ask about Neynar usage
  let useNeynar = true;
  let neynarApiKey = null;
  let neynarClientId = null;
  let neynarAppName = null;
  let neynarAppLogoUrl = null;

  while (useNeynar) {
    let neynarAnswers;
    if (autoAcceptDefaults) {
      neynarAnswers = { useNeynar: true };
    } else {
      neynarAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useNeynar',
          message: `🪐 ${purple}${bright}${italic}Neynar is an API that makes it easy to build on Farcaster.${reset}\n\n` +
          'Benefits of using Neynar in your mini app:\n' +
          '- Pre-configured webhook handling (no setup required)\n' +
          '- Automatic mini app analytics in your dev portal\n' +
          '- Send manual notifications from dev.neynar.com\n' +
          '- Built-in rate limiting and error handling\n\n' +
          `${purple}${bright}${italic}A demo API key is included if you would like to try out Neynar before signing up!${reset}\n\n` +
          'Would you like to use Neynar in your mini app?',
          default: true
        }
      ]);
    }

    if (!neynarAnswers.useNeynar) {
      useNeynar = false;
      break;
    }

    console.log('\n🪐 Find your Neynar API key at: https://dev.neynar.com/app\n');
    
    let neynarKeyAnswer;
    if (autoAcceptDefaults) {
      neynarKeyAnswer = { neynarApiKey: null };
    } else {
      neynarKeyAnswer = await inquirer.prompt([
        {
          type: 'password',
          name: 'neynarApiKey',
          message: 'Enter your Neynar API key (or press enter to skip):',
          default: null
        }
      ]);
    }

    if (neynarKeyAnswer.neynarApiKey) {
      neynarApiKey = neynarKeyAnswer.neynarApiKey;
    } else {
      let useDemoKey;
      if (autoAcceptDefaults) {
        useDemoKey = { useDemo: true };
      } else {
        useDemoKey = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useDemo',
            message: 'Would you like to try the demo Neynar API key?',
            default: true
          }
        ]);
      }

      if (useDemoKey.useDemo) {
        console.warn('\n⚠️ Note: the demo key is for development purposes only and is aggressively rate limited.');
        console.log('For production, please sign up for a Neynar account at https://neynar.com/ and configure the API key in your .env or .env.local file with NEYNAR_API_KEY.');
        console.log(`\n${purple}${bright}${italic}Neynar now has a free tier! See https://neynar.com/#pricing for details.\n${reset}`);
        neynarApiKey = 'FARCASTER_V2_FRAMES_DEMO';
      }
    }

    if (!neynarApiKey) {
      if (autoAcceptDefaults) {
        useNeynar = false;
        break;
      }
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
      if (autoAcceptDefaults) {
        useNeynar = false;
        break;
      }
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

  const defaultMiniAppName = (neynarAppName && !neynarAppName.toLowerCase().includes('demo')) ? neynarAppName : undefined;

  let answers;
  if (autoAcceptDefaults) {
    answers = {
      projectName: projectName || defaultMiniAppName || 'my-farcaster-mini-app',
      description: 'A Farcaster mini app created with Neynar',
      primaryCategory: null,
      tags: [],
      buttonText: 'Launch Mini App',
      useWallet: true,
      useTunnel: true,
      enableAnalytics: true
    };
  } else {
    // If autoAcceptDefaults is false but we have a projectName, we still need to ask for other options
    const projectNamePrompt = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'What is the name of your mini app?',
        default: projectName || defaultMiniAppName,
        validate: (input) => {
          if (input.trim() === '') {
            return 'Project name cannot be empty';
          }
          return true;
        }
      }
    ]);
    
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Give a one-line description of your mini app (optional):',
        default: 'A Farcaster mini app created with Neynar'
      },
      {
        type: 'list',
        name: 'primaryCategory',
        message: 'It is strongly recommended to choose a primary category and tags to help users discover your mini app.\n\nSelect a primary category:',
        choices: [
          new inquirer.Separator(),
          { name: 'Skip (not recommended)', value: null },
          new inquirer.Separator(),
          { name: 'Games', value: 'games' },
          { name: 'Social', value: 'social' },
          { name: 'Finance', value: 'finance' },
          { name: 'Utility', value: 'utility' },
          { name: 'Productivity', value: 'productivity' },
          { name: 'Health & Fitness', value: 'health-fitness' },
          { name: 'News & Media', value: 'news-media' },
          { name: 'Music', value: 'music' },
          { name: 'Shopping', value: 'shopping' },
          { name: 'Education', value: 'education' },
          { name: 'Developer Tools', value: 'developer-tools' },
          { name: 'Entertainment', value: 'entertainment' },
          { name: 'Art & Creativity', value: 'art-creativity' }
        ],
        default: null
      },
      {
        type: 'input',
        name: 'tags',
        message: 'Enter tags for your mini app (separate with spaces or commas, optional):',
        default: '',
        filter: (input) => {
          if (!input.trim()) return [];
          // Split by both spaces and commas, trim whitespace, and filter out empty strings
          return input
            .split(/[,\s]+/)
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        }
      },
      {
        type: 'input',
        name: 'buttonText',
        message: 'Enter the button text for your mini app:',
        default: 'Launch Mini App',
        validate: (input) => {
          if (input.trim() === '') {
            return 'Button text cannot be empty';
          }
          return true;
        }
      }
    ]);

    // Merge project name from the first prompt
    answers.projectName = projectNamePrompt.projectName;

    // Ask about wallet and transaction tooling
    const walletAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useWallet',
        message: 'Would you like to include wallet and transaction tooling in your mini app?\n' +
          'This includes:\n' +
          '- EVM wallet connection\n' +
          '- Transaction signing\n' +
          '- Message signing\n' +
          '- Chain switching\n' +
          '- Solana support\n\n' +
          'Include wallet and transaction features?',
        default: true
      }
    ]);
    answers.useWallet = walletAnswer.useWallet;

    // Ask about localhost vs tunnel
    const hostingAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useTunnel',
        message: 'Would you like to test on mobile and/or test the app with Warpcast developer tools?\n' +
          `⚠️ ${yellow}${italic}Both mobile testing and the Warpcast debugger require setting up a tunnel to serve your app from localhost to the broader internet.\n${reset}` +
          'Configure a tunnel for mobile testing and/or Warpcast developer tools?',
        default: true
      }
    ]);
    answers.useTunnel = hostingAnswer.useTunnel;

    // Ask about analytics opt-out
    const analyticsAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableAnalytics',
        message: 'Would you like to help improve Neynar products by sharing usage data from your mini app?',
        default: true
      }
    ]);
    answers.enableAnalytics = analyticsAnswer.enableAnalytics;
  }

  const finalProjectName = answers.projectName;
  const projectDirName = finalProjectName.replace(/\s+/g, '-').toLowerCase();
  const projectPath = path.join(process.cwd(), projectDirName);

  console.log(`\nCreating a new mini app in ${projectPath}`);

  // Clone the repository
  try {
    console.log(`\nCloning repository from ${REPO_URL}...`);
    // Use separate commands for better cross-platform compatibility
    execSync(`git clone ${REPO_URL} "${projectPath}"`, { 
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    execSync('git fetch origin main', { 
      cwd: projectPath, 
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    execSync('git reset --hard origin/main', { 
      cwd: projectPath, 
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
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

  packageJson.name = finalProjectName;
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
    "@farcaster/auth-client": ">=0.3.0 <1.0.0",
    "@farcaster/auth-kit": ">=0.6.0 <1.0.0",
    "@farcaster/miniapp-node": ">=0.1.5 <1.0.0",
    "@farcaster/miniapp-sdk": ">=0.1.6 <1.0.0",
    "@farcaster/miniapp-wagmi-connector": "^1.0.0",
    "@farcaster/mini-app-solana": ">=0.0.17 <1.0.0",
    "@neynar/react": "^1.2.5",
    "@radix-ui/react-label": "^2.1.1",
    "@solana/wallet-adapter-react": "^0.15.38",
    "@tanstack/react-query": "^5.61.0",
    "@upstash/redis": "^1.34.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dotenv": "^16.4.7",
    "lucide-react": "^0.469.0",
    "mipd": "^0.0.7",
    "next": "^15",
    "next-auth": "^4.24.11",
    "react": "^19",
    "react-dom": "^19",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "viem": "^2.23.6",
    "wagmi": "^2.14.12",
    "zod": "^3.24.2"
  };

  packageJson.devDependencies = {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vercel/sdk": "^1.9.0",
    "crypto": "^1.0.1",
    "eslint": "^8",
    "eslint-config-next": "15.0.3",
    "localtunnel": "^2.0.2",
    "pino-pretty": "^13.0.0",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  };

  // Add Neynar SDK if selected
  if (useNeynar) {
    packageJson.dependencies['@neynar/nodejs-sdk'] = '^2.19.0';
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

    // Append remaining environment variables
    // Update constants.ts file with user-provided values
    console.log('\nUpdating constants.ts...');
    const constantsPath = path.join(projectPath, 'src', 'lib', 'constants.ts');
    if (fs.existsSync(constantsPath)) {
      let constantsContent = fs.readFileSync(constantsPath, 'utf8');
      
      // Helper function to escape single quotes in strings
      const escapeString = (str) => str.replace(/'/g, "\\'");
      
      // Helper function to safely replace constants with validation
      const safeReplace = (content, pattern, replacement, constantName) => {
        const match = content.match(pattern);
        if (!match) {
          console.log(`⚠️  Warning: Could not update ${constantName} in constants.ts. Pattern not found.`);
          console.log(`Pattern: ${pattern}`);
          console.log(`Expected to match in: ${content.split('\n').find(line => line.includes(constantName)) || 'Not found'}`);
        } else {
          const newContent = content.replace(pattern, replacement);
          return newContent;
        }
        return content;
      };
      
      // Regex patterns that match whole lines with export const
      const patterns = {
        APP_NAME: /^export const APP_NAME\s*=\s*['"`][^'"`]*['"`];$/m,
        APP_DESCRIPTION: /^export const APP_DESCRIPTION\s*=\s*['"`][^'"`]*['"`];$/m,
        APP_PRIMARY_CATEGORY: /^export const APP_PRIMARY_CATEGORY\s*=\s*['"`][^'"`]*['"`];$/m,
        APP_TAGS: /^export const APP_TAGS\s*=\s*\[[^\]]*\];$/m,
        APP_BUTTON_TEXT: /^export const APP_BUTTON_TEXT\s*=\s*['"`][^'"`]*['"`];$/m,
        USE_WALLET: /^export const USE_WALLET\s*=\s*(true|false);$/m,
        ANALYTICS_ENABLED: /^export const ANALYTICS_ENABLED\s*=\s*(true|false);$/m
      };
      
      // Update APP_NAME
      constantsContent = safeReplace(
        constantsContent,
        patterns.APP_NAME,
        `export const APP_NAME = '${escapeString(answers.projectName)}';`,
        'APP_NAME'
      );
      
      // Update APP_DESCRIPTION
      constantsContent = safeReplace(
        constantsContent,
        patterns.APP_DESCRIPTION,
        `export const APP_DESCRIPTION = '${escapeString(answers.description)}';`,
        'APP_DESCRIPTION'
      );
      
      // Update APP_PRIMARY_CATEGORY (always update, null becomes empty string)
      constantsContent = safeReplace(
        constantsContent,
        patterns.APP_PRIMARY_CATEGORY,
        `export const APP_PRIMARY_CATEGORY = '${escapeString(answers.primaryCategory || '')}';`,
        'APP_PRIMARY_CATEGORY'
      );
      
      // Update APP_TAGS
      const tagsString = answers.tags.length > 0 
        ? `['${answers.tags.map(tag => escapeString(tag)).join("', '")}']` 
        : "['neynar', 'starter-kit', 'demo']";
      constantsContent = safeReplace(
        constantsContent,
        patterns.APP_TAGS,
        `export const APP_TAGS = ${tagsString};`,
        'APP_TAGS'
      );
      
      // Update APP_BUTTON_TEXT (always update, use answers value)
      constantsContent = safeReplace(
        constantsContent,
        patterns.APP_BUTTON_TEXT,
        `export const APP_BUTTON_TEXT = '${escapeString(answers.buttonText || '')}';`,
        'APP_BUTTON_TEXT'
      );
      
      // Update USE_WALLET
      constantsContent = safeReplace(
        constantsContent,
        patterns.USE_WALLET,
        `export const USE_WALLET = ${answers.useWallet};`,
        'USE_WALLET'
      );
      
      // Update ANALYTICS_ENABLED
      constantsContent = safeReplace(
        constantsContent,
        patterns.ANALYTICS_ENABLED,
        `export const ANALYTICS_ENABLED = ${answers.enableAnalytics};`,
        'ANALYTICS_ENABLED'
      );
      
      fs.writeFileSync(constantsPath, constantsContent);
    } else {
      console.log('⚠️  constants.ts not found, skipping constants update');
    }

    fs.appendFileSync(envPath, `\nNEXTAUTH_SECRET="${crypto.randomBytes(32).toString('hex')}"`);
    if (useNeynar && neynarApiKey && neynarClientId) {
      fs.appendFileSync(envPath, `\nNEYNAR_API_KEY="${neynarApiKey}"`);
      fs.appendFileSync(envPath, `\nNEYNAR_CLIENT_ID="${neynarClientId}"`);
    } else if (useNeynar) {
      console.log('\n⚠️  Could not find a Neynar client ID and/or API key. Please configure Neynar manually in .env.local with NEYNAR_API_KEY and NEYNAR_CLIENT_ID');
    }
    fs.appendFileSync(envPath, `\nUSE_TUNNEL="${answers.useTunnel}"`);
    
    fs.unlinkSync(envExamplePath);
  } else {
    console.log('\n.env.example does not exist, skipping copy and remove operations');
  }

  // Update README
  console.log('\nUpdating README...');
  const readmePath = path.join(projectPath, 'README.md');
  const prependText = `<!-- generated by @neynar/create-farcaster-mini-app version ${SCRIPT_VERSION} -->\n\n`;
  if (fs.existsSync(readmePath)) {
    const originalReadmeContent = fs.readFileSync(readmePath, { encoding: 'utf8' });
    const updatedReadmeContent = prependText + originalReadmeContent;
    fs.writeFileSync(readmePath, updatedReadmeContent);
  } else {
    fs.writeFileSync(readmePath, prependText);
  }

  // Install dependencies
  console.log('\nInstalling dependencies...');

  execSync('npm cache clean --force', { 
    cwd: projectPath, 
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  execSync('npm install', { 
    cwd: projectPath, 
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

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
  execSync('git commit -m "initial commit from @neynar/create-farcaster-mini-app"', { cwd: projectPath });

  // Calculate border length based on message length
  const message = `✨🪐 Successfully created mini app ${finalProjectName} with git and dependencies installed! 🪐✨`;
  const borderLength = message.length;
  const borderStars = '✨'.repeat((borderLength / 2) + 1);

  console.log(`\n${borderStars}`);
  console.log(`${message}`);
  console.log(`${borderStars}`);
  console.log('\nTo run the app:');
  console.log(`  cd ${finalProjectName}`);
  console.log('  npm run dev\n');
}
