import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { mnemonicToAccount } from 'viem/accounts';
import { Vercel } from '@vercel/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Load environment variables in specific order
dotenv.config({ path: '.env' });

async function validateSeedPhrase(seedPhrase) {
  try {
    const account = mnemonicToAccount(seedPhrase);
    return account.address;
  } catch (error) {
    throw new Error('Invalid seed phrase');
  }
}

async function lookupFidByCustodyAddress(custodyAddress, apiKey) {
  if (!apiKey) {
    throw new Error('Neynar API key is required');
  }
  const lowerCasedCustodyAddress = custodyAddress.toLowerCase();

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${lowerCasedCustodyAddress}&address_types=custody_address`,
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
  if (!data[lowerCasedCustodyAddress]?.length || !data[lowerCasedCustodyAddress][0].custody_address) {
    throw new Error('No FID found for this custody address');
  }

  return data[lowerCasedCustodyAddress][0].fid;
}

async function generateFarcasterMetadata(domain, fid, accountAddress, seedPhrase, webhookUrl) {
  const trimmedDomain = domain.trim();
  const header = {
    type: 'custody',
    key: accountAddress,
    fid,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64');

  const payload = {
    domain: trimmedDomain
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');

  const account = mnemonicToAccount(seedPhrase);
  const signature = await account.signMessage({ 
    message: `${encodedHeader}.${encodedPayload}`
  });
  const encodedSignature = Buffer.from(signature, 'utf-8').toString('base64url');

  const tags = process.env.NEXT_PUBLIC_MINI_APP_TAGS?.split(',');

  return {
    accountAssociation: {
      header: encodedHeader,
      payload: encodedPayload,
      signature: encodedSignature
    },
    frame: {
      version: "1",
      name: process.env.NEXT_PUBLIC_MINI_APP_NAME,
      iconUrl: `https://${trimmedDomain}/icon.png`,
      homeUrl: `https://${trimmedDomain}`,
      imageUrl: `https://${trimmedDomain}/api/opengraph-image`,
      buttonTitle: process.env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT,
      splashImageUrl: `https://${trimmedDomain}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl: webhookUrl?.trim(),
      description: process.env.NEXT_PUBLIC_MINI_APP_DESCRIPTION,
      primaryCategory: process.env.NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY,
      tags,
    },
  };
}

async function loadEnvLocal() {
  try {
    if (fs.existsSync('.env.local')) {
      const { loadLocal } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'loadLocal',
          message: 'Found .env.local - would you like to load its values in addition to .env values? (except for SEED_PHRASE, values will be written to .env)',
          default: true
        }
      ]);

      if (loadLocal) {
        console.log('Loading values from .env.local...');
        const localEnv = dotenv.parse(fs.readFileSync('.env.local'));
        
        const allowedVars = [
          'SEED_PHRASE',
          'NEXT_PUBLIC_MINI_APP_NAME',
          'NEXT_PUBLIC_MINI_APP_DESCRIPTION',
          'NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY',
          'NEXT_PUBLIC_MINI_APP_TAGS',
          'NEXT_PUBLIC_MINI_APP_BUTTON_TEXT',
          'NEXT_PUBLIC_ANALYTICS_ENABLED',
          'NEYNAR_API_KEY',
          'NEYNAR_CLIENT_ID'
        ];
        
        const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') + '\n' : '';
        let newEnvContent = envContent;
        
        for (const [key, value] of Object.entries(localEnv)) {
          if (allowedVars.includes(key)) {
            process.env[key] = value;
            if (key !== 'SEED_PHRASE' && !envContent.includes(`${key}=`)) {
              newEnvContent += `${key}="${value}"\n`;
            }
          }
        }
        
        fs.writeFileSync('.env', newEnvContent);
        console.log('✅ Values from .env.local have been written to .env');
      }
    }
  } catch (error) {
    console.log('Note: No .env.local file found');
  }
}

async function checkRequiredEnvVars() {
  console.log('\n📝 Checking environment variables...');
  console.log('Loading values from .env...');
  
  await loadEnvLocal();

  const requiredVars = [
    {
      name: 'NEXT_PUBLIC_MINI_APP_NAME',
      message: 'Enter the name for your frame (e.g., My Cool Mini App):',
      default: process.env.NEXT_PUBLIC_MINI_APP_NAME,
      validate: input => input.trim() !== '' || 'Mini app name cannot be empty'
    },
    {
      name: 'NEXT_PUBLIC_MINI_APP_BUTTON_TEXT',
      message: 'Enter the text for your frame button:',
      default: process.env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT ?? 'Launch Mini App',
      validate: input => input.trim() !== '' || 'Button text cannot be empty'
    }
  ];

  const missingVars = requiredVars.filter(varConfig => !process.env[varConfig.name]);
  
  if (missingVars.length > 0) {
    console.log('\n⚠️  Some required information is missing. Let\'s set it up:');
    for (const varConfig of missingVars) {
      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: varConfig.message,
          default: varConfig.default,
          validate: varConfig.validate
        }
      ]);
      
      process.env[varConfig.name] = value;
      
      const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
      
      if (!envContent.includes(`${varConfig.name}=`)) {
        const newLine = envContent ? '\n' : '';
        fs.appendFileSync('.env', `${newLine}${varConfig.name}="${value.trim()}"`);
      }
    }
  }

  // Check for seed phrase
  if (!process.env.SEED_PHRASE) {
    console.log('\n🔑 Mini App Manifest Signing');
    console.log('A signed manifest helps users trust your mini app.');
    const { seedPhrase } = await inquirer.prompt([
      {
        type: 'password',
        name: 'seedPhrase',
        message: 'Enter your Farcaster custody account seed phrase to sign the mini app manifest\n(optional -- leave blank to create an unsigned mini app)\n\nSeed phrase:',
        default: null
      }
    ]);

    if (seedPhrase) {
      process.env.SEED_PHRASE = seedPhrase;
      
      const { storeSeedPhrase } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'storeSeedPhrase',
          message: 'Would you like to store this seed phrase in .env.local for future use?',
          default: false
        }
      ]);

      if (storeSeedPhrase) {
        fs.appendFileSync('.env.local', `\nSEED_PHRASE="${seedPhrase}"`);
        console.log('✅ Seed phrase stored in .env.local');
      } else {
        console.log('ℹ️  Seed phrase will only be used for this deployment');
      }
    }
  }
}

async function getGitRemote() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { 
      cwd: projectRoot,
      encoding: 'utf8'
    }).trim();
    return remoteUrl;
  } catch (error) {
    return null;
  }
}

async function checkVercelCLI() {
  try {
    execSync('vercel --version', { 
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function installVercelCLI() {
  console.log('Installing Vercel CLI...');
  execSync('npm install -g vercel', { 
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
}

async function getVercelToken() {
  try {
    // Try to get token from Vercel CLI config
    const configPath = path.join(os.homedir(), '.vercel', 'auth.json');
    if (fs.existsSync(configPath)) {
      const authConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return authConfig.token;
    }
  } catch (error) {
    console.warn('Could not read Vercel token from config file');
  }
  
  // Try environment variable
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN;
  }
  
  // Try to extract from vercel whoami
  try {
    const whoamiOutput = execSync('vercel whoami', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // If we can get whoami, we're logged in, but we need the actual token
    // The token isn't directly exposed, so we'll need to use CLI for some operations
    console.log('✅ Verified Vercel CLI authentication');
    return null; // We'll fall back to CLI operations
  } catch (error) {
    throw new Error('Not logged in to Vercel CLI. Please run this script again to login.');
  }
}

async function loginToVercel() {
  console.log('\n🔑 Vercel Login');
  console.log('You can either:');
  console.log('1. Log in to an existing Vercel account');
  console.log('2. Create a new Vercel account during login\n');
  console.log('If creating a new account:');
  console.log('1. Click "Continue with GitHub"');
  console.log('2. Authorize GitHub access');
  console.log('3. Complete the Vercel account setup in your browser');
  console.log('4. Return here once your Vercel account is created\n');
  console.log('\nNote: you may need to cancel this script with ctrl+c and run it again if creating a new vercel account');
  
  const child = spawn('vercel', ['login'], {
    stdio: 'inherit'
  });

  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      resolve();
    });
  });

  console.log('\n📱 Waiting for login to complete...');
  console.log('If you\'re creating a new account, please complete the Vercel account setup in your browser first.');
  
  for (let i = 0; i < 150; i++) {
    try {
      execSync('vercel whoami', { stdio: 'ignore' });
      console.log('✅ Successfully logged in to Vercel!');
      return true;
    } catch (error) {
      if (error.message.includes('Account not found')) {
        console.log('ℹ️  Waiting for Vercel account setup to complete...');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.error('\n❌ Login timed out. Please ensure you have:');
  console.error('1. Completed the Vercel account setup in your browser');
  console.error('2. Authorized the GitHub integration');
  console.error('Then try running this script again.');
  return false;
}

async function setVercelEnvVarSDK(vercelClient, projectId, key, value) {
  try {
    let processedValue;
    if (typeof value === 'object') {
      processedValue = JSON.stringify(value);
    } else {
      processedValue = value.toString();
    }

    // Get existing environment variables
    const existingVars = await vercelClient.projects.getEnvironmentVariables({
      idOrName: projectId
    });

    const existingVar = existingVars.envs?.find(env => 
      env.key === key && env.target?.includes('production')
    );

    if (existingVar) {
      // Update existing variable
      await vercelClient.projects.editEnvironmentVariable({
        idOrName: projectId,
        id: existingVar.id,
        requestBody: {
          value: processedValue,
          target: ['production']
        }
      });
      console.log(`✅ Updated environment variable: ${key}`);
    } else {
      // Create new variable
      await vercelClient.projects.createEnvironmentVariable({
        idOrName: projectId,
        requestBody: {
          key: key,
          value: processedValue,
          type: 'encrypted',
          target: ['production']
        }
      });
      console.log(`✅ Created environment variable: ${key}`);
    }
    
    return true;
  } catch (error) {
    console.warn(`⚠️  Warning: Failed to set environment variable ${key}:`, error.message);
    return false;
  }
}

async function setVercelEnvVarCLI(key, value, projectRoot) {
  try {
    // Remove existing env var
    try {
      execSync(`vercel env rm ${key} production -y`, {
        cwd: projectRoot,
        stdio: 'ignore',
        env: process.env
      });
    } catch (error) {
      // Ignore errors from removal
    }

    let processedValue;
    if (typeof value === 'object') {
      processedValue = JSON.stringify(value);
    } else {
      processedValue = value.toString();
    }

    // Create temporary file
    const tempFilePath = path.join(projectRoot, `${key}_temp.txt`);
    fs.writeFileSync(tempFilePath, processedValue, 'utf8');

    // Use appropriate command based on platform
    let command;
    if (process.platform === 'win32') {
      command = `type "${tempFilePath}" | vercel env add ${key} production`;
    } else {
      command = `cat "${tempFilePath}" | vercel env add ${key} production`;
    }

    execSync(command, {
      cwd: projectRoot,
      stdio: 'pipe', // Changed from 'inherit' to avoid interactive prompts
      shell: true,
      env: process.env
    });

    fs.unlinkSync(tempFilePath);
    console.log(`✅ Set environment variable: ${key}`);
    return true;
  } catch (error) {
    const tempFilePath = path.join(projectRoot, `${key}_temp.txt`);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    console.warn(`⚠️  Warning: Failed to set environment variable ${key}:`, error.message);
    return false;
  }
}

async function setEnvironmentVariables(vercelClient, projectId, envVars, projectRoot) {
  console.log('\n📝 Setting up environment variables...');
  
  const results = [];
  
  for (const [key, value] of Object.entries(envVars)) {
    if (!value) continue;
    
    let success = false;
    
    // Try SDK approach first if we have a Vercel client
    if (vercelClient && projectId) {
      success = await setVercelEnvVarSDK(vercelClient, projectId, key, value);
    }
    
    // Fallback to CLI approach
    if (!success) {
      success = await setVercelEnvVarCLI(key, value, projectRoot);
    }
    
    results.push({ key, success });
  }
  
  // Report results
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.warn(`\n⚠️  Failed to set ${failed.length} environment variables:`);
    failed.forEach(r => console.warn(`   - ${r.key}`));
    console.warn('\nYou may need to set these manually in the Vercel dashboard.');
  }
  
  return results;
}

async function deployToVercel(useGitHub = false) {
  try {
    console.log('\n🚀 Deploying to Vercel...');
    
    // Ensure vercel.json exists
    const vercelConfigPath = path.join(projectRoot, 'vercel.json');
    if (!fs.existsSync(vercelConfigPath)) {
      console.log('📝 Creating vercel.json configuration...');
      fs.writeFileSync(vercelConfigPath, JSON.stringify({
        buildCommand: "next build",
        framework: "nextjs"
      }, null, 2));
    }

    // Set up Vercel project
    console.log('\n📦 Setting up Vercel project...');
    console.log('An initial deployment is required to get an assigned domain that can be used in the mini app manifest\n');
    console.log('\n⚠️ Note: choosing a longer, more unique project name will help avoid conflicts with other existing domains\n');
    
    execSync('vercel', { 
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    // Load project info
    const projectJson = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
    const projectId = projectJson.projectId;

    // Get Vercel token and initialize SDK client
    let vercelClient = null;
    try {
      const token = await getVercelToken();
      if (token) {
        vercelClient = new Vercel({
          bearerToken: token
        });
        console.log('✅ Initialized Vercel SDK client');
      }
    } catch (error) {
      console.warn('⚠️  Could not initialize Vercel SDK, falling back to CLI operations');
    }

    // Get project details
    console.log('\n🔍 Getting project details...');
    let domain;
    let projectName;

    if (vercelClient) {
      try {
        const project = await vercelClient.projects.get({
          idOrName: projectId
        });
        projectName = project.name;
        domain = `${projectName}.vercel.app`;
        console.log('🌐 Using project name for domain:', domain);
      } catch (error) {
        console.warn('⚠️  Could not get project details via SDK, using CLI fallback');
      }
    }

    // Fallback to CLI method if SDK failed
    if (!domain) {
      const inspectOutput = execSync(`vercel project inspect ${projectId} 2>&1`, {
        cwd: projectRoot,
        encoding: 'utf8'
      });

      const nameMatch = inspectOutput.match(/Name\s+([^\n]+)/);
      if (nameMatch) {
        projectName = nameMatch[1].trim();
        domain = `${projectName}.vercel.app`;
        console.log('🌐 Using project name for domain:', domain);
      } else {
        const altMatch = inspectOutput.match(/Found Project [^/]+\/([^\n]+)/);
        if (altMatch) {
          projectName = altMatch[1].trim();
          domain = `${projectName}.vercel.app`;
          console.log('🌐 Using project name for domain:', domain);
        } else {
          throw new Error('Could not determine project name from inspection output');
        }
      }
    }

    // Generate mini app metadata if we have a seed phrase
    let miniAppMetadata;
    let fid;
    if (process.env.SEED_PHRASE) {
      console.log('\n🔨 Generating mini app metadata...');
      const accountAddress = await validateSeedPhrase(process.env.SEED_PHRASE);
      fid = await lookupFidByCustodyAddress(accountAddress, process.env.NEYNAR_API_KEY ?? 'FARCASTER_V2_FRAMES_DEMO');
      
      const webhookUrl = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID 
        ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
        : `https://${domain}/api/webhook`;

      miniAppMetadata = await generateFarcasterMetadata(domain, fid, accountAddress, process.env.SEED_PHRASE, webhookUrl);
      console.log('✅ Mini app metadata generated and signed');
    }

    // Prepare environment variables
    const nextAuthSecret = process.env.NEXTAUTH_SECRET || crypto.randomBytes(32).toString('hex');
    const vercelEnv = {
      NEXTAUTH_SECRET: nextAuthSecret,
      AUTH_SECRET: nextAuthSecret,
      NEXTAUTH_URL: `https://${domain}`,
      NEXT_PUBLIC_URL: `https://${domain}`,
      
      ...(process.env.NEYNAR_API_KEY && { NEYNAR_API_KEY: process.env.NEYNAR_API_KEY }),
      ...(process.env.NEYNAR_CLIENT_ID && { NEYNAR_CLIENT_ID: process.env.NEYNAR_CLIENT_ID }),
      ...(miniAppMetadata && { MINI_APP_METADATA: miniAppMetadata }),
      
      ...Object.fromEntries(
        Object.entries(process.env)
          .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
      )
    };

    // Set environment variables
    await setEnvironmentVariables(vercelClient, projectId, vercelEnv, projectRoot);

    // Deploy the project
    if (useGitHub) {
      console.log('\nSetting up GitHub integration...');
      execSync('vercel link', { 
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env
      });
      console.log('\n📦 Deploying with GitHub integration...');
    } else {
      console.log('\n📦 Deploying local code directly...');
    }

    execSync('vercel deploy --prod', { 
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    // Verify actual domain after deployment
    console.log('\n🔍 Verifying deployment domain...');
    
    let actualDomain = domain;
    if (vercelClient) {
      try {
        const deployments = await vercelClient.deployments.list({
          projectId: projectId,
          limit: 1
        });
        
        if (deployments.deployments?.[0]?.url) {
          actualDomain = deployments.deployments[0].url;
          console.log('🌐 Verified actual domain:', actualDomain);
        }
      } catch (error) {
        console.warn('⚠️  Could not verify domain via SDK, using assumed domain');
      }
    }

    // Update environment variables if domain changed
    if (actualDomain !== domain) {
      console.log('🔄 Updating environment variables with correct domain...');
      
      const webhookUrl = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID 
        ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
        : `https://${actualDomain}/api/webhook`;

      const updatedEnv = {
        NEXTAUTH_URL: `https://${actualDomain}`,
        NEXT_PUBLIC_URL: `https://${actualDomain}`
      };

      if (miniAppMetadata) {
        const updatedMetadata = await generateFarcasterMetadata(actualDomain, fid, await validateSeedPhrase(process.env.SEED_PHRASE), process.env.SEED_PHRASE, webhookUrl);
        updatedEnv.MINI_APP_METADATA = updatedMetadata;
      }

      await setEnvironmentVariables(vercelClient, projectId, updatedEnv, projectRoot);

      console.log('\n📦 Redeploying with correct domain...');
      execSync('vercel deploy --prod', { 
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env
      });
      
      domain = actualDomain;
    }
    
    console.log('\n✨ Deployment complete! Your mini app is now live at:');
    console.log(`🌐 https://${domain}`);
    console.log('\n📝 You can manage your project at https://vercel.com/dashboard');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    console.log('🚀 Vercel Mini App Deployment (SDK Edition)');
    console.log('This script will deploy your mini app to Vercel using the Vercel SDK.');
    console.log('\nThe script will:');
    console.log('1. Check for required environment variables');
    console.log('2. Set up a Vercel project (new or existing)');
    console.log('3. Configure environment variables in Vercel using SDK');
    console.log('4. Deploy and build your mini app\n');

    // Check if @vercel/sdk is installed
    try {
      await import('@vercel/sdk');
    } catch (error) {
      console.log('📦 Installing @vercel/sdk...');
      execSync('npm install @vercel/sdk', { 
        cwd: projectRoot,
        stdio: 'inherit'
      });
      console.log('✅ @vercel/sdk installed successfully');
    }

    await checkRequiredEnvVars();

    const remoteUrl = await getGitRemote();
    let useGitHub = false;

    if (remoteUrl) {
      console.log('\n📦 Found GitHub repository:', remoteUrl);
      const { useGitHubDeploy } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useGitHubDeploy',
          message: 'Would you like to deploy from the GitHub repository?',
          default: true
        }
      ]);
      useGitHub = useGitHubDeploy;
    } else {
      console.log('\n⚠️  No GitHub repository found.');
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Deploy local code directly', value: 'deploy' },
            { name: 'Set up GitHub repository first', value: 'setup' }
          ],
          default: 'deploy'
        }
      ]);

      if (action === 'setup') {
        console.log('\n👋 Please set up your GitHub repository first:');
        console.log('1. Create a new repository on GitHub');
        console.log('2. Run these commands:');
        console.log('   git remote add origin <your-repo-url>');
        console.log('   git push -u origin main');
        console.log('\nThen run this script again to deploy.');
        process.exit(0);
      }
    }

    if (!await checkVercelCLI()) {
      console.log('Vercel CLI not found. Installing...');
      await installVercelCLI();
    }

    if (!await loginToVercel()) {
      console.error('\n❌ Failed to log in to Vercel. Please try again.');
      process.exit(1);
    }

    await deployToVercel(useGitHub);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();