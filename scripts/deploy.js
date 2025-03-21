import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { mnemonicToAccount } from 'viem/accounts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Load environment variables in specific order
// First load .env for main config
dotenv.config({ path: '.env' });

async function validateSeedPhrase(seedPhrase) {
  try {
    // Try to create an account from the seed phrase
    const account = mnemonicToAccount(seedPhrase);
    return account.address;
  } catch (error) {
    throw new Error('Invalid seed phrase');
  }
}

async function generateFarcasterMetadata(domain, accountAddress, seedPhrase, webhookUrl) {
  const header = {
    type: 'custody',
    key: accountAddress,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64');

  const payload = {
    domain
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');

  const account = mnemonicToAccount(seedPhrase);
  const signature = await account.signMessage({ 
    message: `${encodedHeader}.${encodedPayload}`
  });
  const encodedSignature = Buffer.from(signature, 'utf-8').toString('base64url');

  return {
    accountAssociation: {
      header: encodedHeader,
      payload: encodedPayload,
      signature: encodedSignature
    },
    frame: {
      version: "1",
      name: process.env.NEXT_PUBLIC_FRAME_NAME,
      iconUrl: process.env.NEXT_PUBLIC_FRAME_ICON_IMAGE_URL || `https://${domain}/icon.png`,
      homeUrl: domain,
      imageUrl: `https://${domain}/opengraph-image`,
      buttonTitle: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT,
      splashImageUrl: process.env.NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL || `https://${domain}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl,
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
        
        // Copy all values except SEED_PHRASE to .env
        const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') + '\n' : '';
        let newEnvContent = envContent;
        
        for (const [key, value] of Object.entries(localEnv)) {
          if (key !== 'SEED_PHRASE') {
            // Update process.env
            process.env[key] = value;
            // Add to .env content if not already there
            if (!envContent.includes(`${key}=`)) {
              newEnvContent += `${key}="${value}"\n`;
            }
          }
        }
        
        // Write updated content to .env
        fs.writeFileSync('.env', newEnvContent);
        console.log('✅ Values from .env.local have been written to .env');
      }
    }

    // Always try to load SEED_PHRASE from .env.local
    if (fs.existsSync('.env.local')) {
      const localEnv = dotenv.parse(fs.readFileSync('.env.local'));
      if (localEnv.SEED_PHRASE) {
        process.env.SEED_PHRASE = localEnv.SEED_PHRASE;
      }
    }
  } catch (error) {
    // Error reading .env.local, which is fine
    console.log('Note: No .env.local file found');
  }
}

async function checkRequiredEnvVars() {
  console.log('\n📝 Checking environment variables...');
  console.log('Loading values from .env...');
  
  // Load .env.local if user wants to
  await loadEnvLocal();

  const requiredVars = [
    {
      name: 'NEXT_PUBLIC_FRAME_NAME',
      message: 'Enter the name for your frame (e.g., My Cool Frame):',
      default: process.env.NEXT_PUBLIC_FRAME_NAME,
      validate: input => input.trim() !== '' || 'Frame name cannot be empty'
    },
    {
      name: 'NEXT_PUBLIC_FRAME_BUTTON_TEXT',
      message: 'Enter the text for your frame button:',
      default: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT ?? 'Launch Frame',
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
      // Write to both process.env and .env file
      process.env[varConfig.name] = value;
      
      // Read existing .env content
      const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
      
      // Check if the variable already exists in .env
      if (!envContent.includes(`${varConfig.name}=`)) {
        // Append the new variable to .env
        fs.appendFileSync('.env', `\n${varConfig.name}="${value}"`);
      }
    }
  }

  // Check for seed phrase
  if (!process.env.SEED_PHRASE) {
    console.log('\n🔑 Frame Manifest Signing');
    console.log('A signed manifest helps users trust your frame.');
    const { seedPhrase } = await inquirer.prompt([
      {
        type: 'password',
        name: 'seedPhrase',
        message: 'Enter your Farcaster custody account seed phrase to sign the frame manifest\n(optional -- leave blank to create an unsigned frame)\n\nSeed phrase:',
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
        // Write to .env.local
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
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

async function installVercelCLI() {
  console.log('Installing Vercel CLI...');
  execSync('npm install -g vercel', { stdio: 'inherit' });
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
  
  // Start the login process
  const child = spawn('vercel', ['login'], {
    stdio: 'inherit'
  });

  // Wait for the login process to complete
  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Don't reject here, as the process might exit with non-zero
        // during the browser auth flow
        resolve();
      }
    });
  });

  // After the browser flow completes, verify we're actually logged in
  // Keep checking for up to 5 minutes (increased timeout for new account setup)
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
      // Still not logged in, wait 2 seconds before trying again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.error('\n❌ Login timed out. Please ensure you have:');
  console.error('1. Completed the Vercel account setup in your browser');
  console.error('2. Authorized the GitHub integration');
  console.error('Then try running this script again.');
  return false;
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

    // First try to link to an existing project
    console.log('\n🔗 Checking for existing Vercel projects...');
    let isNewProject = false;
    let projectName = '';
    let domain = '';

    try {
      execSync('vercel link', { 
        cwd: projectRoot,
        stdio: 'inherit'
      });
      
      // Get project info after linking
      // question: do these lines do anything?
      const projectOutput = execSync('vercel project ls', { 
        cwd: projectRoot,
        encoding: 'utf8'
      });
      
      // Extract domain from project output
      const projectLines = projectOutput.split('\n');
      const currentProject = projectLines.find(line => line.includes('(current)'));
      if (currentProject) {
        const parts = currentProject.split(/\s+/);
        projectName = parts[0];
        domain = parts[1]?.replace('https://', '') || '';
        console.log('🌐 Found existing project domain:', domain);
      } else {
        throw new Error('No existing project found');
      }
    } catch (error) {
      // If linking fails (user declines to link), create a new project
      console.log('\n📦 Creating new Vercel project...');
      execSync('vercel', { 
        cwd: projectRoot,
        stdio: 'inherit'
      });
      
      // Use NEXT_PUBLIC_FRAME_NAME for domain, replacing spaces with dashes
      projectName = process.env.NEXT_PUBLIC_FRAME_NAME.toLowerCase().replace(/\s+/g, '-');
      domain = `${projectName}.vercel.app`;
      isNewProject = true;
    }

    console.log('🌐 Using frame name for domain:', domain);

    // Generate frame metadata if we have a seed phrase
    let frameMetadata;
    if (process.env.SEED_PHRASE) {
      console.log('\n🔨 Generating frame metadata...');
      const accountAddress = await validateSeedPhrase(process.env.SEED_PHRASE);
      
      // Determine webhook URL based on Neynar configuration
      const webhookUrl = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID 
        ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
        : `https://${domain}/api/webhook`;

      frameMetadata = await generateFarcasterMetadata(domain, accountAddress, process.env.SEED_PHRASE, webhookUrl);
      console.log('✅ Frame metadata generated and signed');
    }

    // Prepare environment variables
    const nextAuthSecret = process.env.NEXTAUTH_SECRET || crypto.randomBytes(32).toString('hex');
    const vercelEnv = {
      // Required vars
      NEXTAUTH_SECRET: nextAuthSecret,
      AUTH_SECRET: nextAuthSecret, // Fallback for some NextAuth versions
      NEXTAUTH_URL: `https://${domain}`, // Add the deployment URL
      
      // Optional vars that should be set if they exist
      ...(process.env.NEYNAR_API_KEY && { NEYNAR_API_KEY: process.env.NEYNAR_API_KEY }),
      ...(process.env.NEYNAR_CLIENT_ID && { NEYNAR_CLIENT_ID: process.env.NEYNAR_CLIENT_ID }),
      
      // Frame metadata and images
      ...(process.env.NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL && { 
        NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL: process.env.NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL 
      }),
      ...(process.env.NEXT_PUBLIC_FRAME_ICON_IMAGE_URL && { 
        NEXT_PUBLIC_FRAME_ICON_IMAGE_URL: process.env.NEXT_PUBLIC_FRAME_ICON_IMAGE_URL 
      }),
      ...(frameMetadata && { FRAME_METADATA: JSON.stringify(frameMetadata) }),
      
      // Public vars
      ...Object.fromEntries(
        Object.entries(process.env)
          .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
      )
    };

    // Add or update env vars in Vercel project
    console.log('\n📝 Setting up environment variables...');
    for (const [key, value] of Object.entries(vercelEnv)) {
      if (value) {
        try {
          // First try to remove the existing env var if it exists
          try {
            execSync(`vercel env rm ${key} production -y`, {
              cwd: projectRoot,
              stdio: 'ignore',
              env: process.env
            });
          } catch (error) {
            // Ignore errors from removal (var might not exist)
          }
          
          // Add the new env var
          execSync(`echo "${value}" | vercel env add ${key} production`, {
            cwd: projectRoot,
            stdio: 'inherit',
            env: process.env
          });
        } catch (error) {
          console.warn(`⚠️  Warning: Failed to set environment variable ${key}`);
        }
      }
    }

    // Deploy the project
    if (useGitHub) {
      console.log('\n📦 Deploying with GitHub integration...');
      execSync('vercel deploy --prod --git', { 
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env
      });
    } else {
      console.log('\n📦 Deploying local code directly...');
      execSync('vercel deploy --prod', { 
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env
      });
    }

    // For new projects, verify the actual domain after deployment
    if (isNewProject) {
      console.log('\n🔍 Verifying deployment domain...');
      const projectOutput = execSync('vercel project ls', { 
        cwd: projectRoot,
        encoding: 'utf8'
      });
      
      const projectLines = projectOutput.split('\n');
      const currentProject = projectLines.find(line => line.includes('(current)'));
      if (currentProject) {
        const actualDomain = currentProject.split(/\s+/)[1]?.replace('https://', '');
        if (actualDomain && actualDomain !== domain) {
          console.log(`⚠️  Actual domain (${actualDomain}) differs from assumed domain (${domain})`);
          console.log('🔄 Updating environment variables with correct domain...');
          
          // Update domain-dependent environment variables
          const webhookUrl = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID 
            ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
            : `https://${actualDomain}/api/webhook`;

          if (frameMetadata) {
            frameMetadata = await generateFarcasterMetadata(actualDomain, await validateSeedPhrase(process.env.SEED_PHRASE), process.env.SEED_PHRASE, webhookUrl);
            // Update FRAME_METADATA env var
            try {
              execSync(`vercel env rm FRAME_METADATA production -y`, {
                cwd: projectRoot,
                stdio: 'ignore',
                env: process.env
              });
              execSync(`echo "${JSON.stringify(frameMetadata)}" | vercel env add FRAME_METADATA production`, {
                cwd: projectRoot,
                stdio: 'inherit',
                env: process.env
              });
            } catch (error) {
              console.warn('⚠️  Warning: Failed to update FRAME_METADATA with correct domain');
            }
          }

          // Update NEXTAUTH_URL
          try {
            execSync(`vercel env rm NEXTAUTH_URL production -y`, {
              cwd: projectRoot,
              stdio: 'ignore',
              env: process.env
            });
            execSync(`echo "https://${actualDomain}" | vercel env add NEXTAUTH_URL production`, {
              cwd: projectRoot,
              stdio: 'inherit',
              env: process.env
            });
          } catch (error) {
            console.warn('⚠️  Warning: Failed to update NEXTAUTH_URL with correct domain');
          }

          // Redeploy with updated environment variables
          console.log('\n📦 Redeploying with correct domain...');
          execSync('vercel deploy --prod', { 
            cwd: projectRoot,
            stdio: 'inherit',
            env: process.env
          });
          
          domain = actualDomain;
        }
      }
    }
    
    console.log('\n✨ Deployment complete! Your frame is now live at:');
    console.log(`🌐 https://${domain}`);
    console.log('\n📝 You can manage your project at https://vercel.com/dashboard');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    // Print welcome message
    console.log('🚀 Vercel Frame Deployment');
    console.log('This script will deploy your frame to Vercel.');
    console.log('\nThe script will:');
    console.log('1. Check for required environment variables');
    console.log('2. Set up a Vercel project (new or existing)');
    console.log('3. Configure environment variables in Vercel');
    console.log('4. Deploy and build your frame (Vercel will run the build automatically)\n');

    // Check for required environment variables
    await checkRequiredEnvVars();

    // Check for git remote
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

    // Check and install Vercel CLI if needed
    if (!await checkVercelCLI()) {
      console.log('Vercel CLI not found. Installing...');
      await installVercelCLI();
    }

    // Login to Vercel
    console.log('pre login');
    if (!await loginToVercel()) {
      console.error('\n❌ Failed to log in to Vercel. Please try again.');
      process.exit(1);
    }

    // Deploy to Vercel
    await deployToVercel(useGitHub);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

