import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { Vercel } from '@vercel/sdk';
import { APP_NAME, APP_BUTTON_TEXT } from '../src/lib/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Load environment variables in specific order
dotenv.config({ path: '.env' });

async function loadEnvLocal(): Promise<void> {
  try {
    if (fs.existsSync('.env.local')) {
      const { loadLocal }: { loadLocal: boolean } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'loadLocal',
          message:
            'Found .env.local - would you like to load its values in addition to .env values?',
          default: true,
        },
      ]);

      if (loadLocal) {
        console.log('Loading values from .env.local...');
        const localEnv = dotenv.parse(fs.readFileSync('.env.local'));

        const allowedVars = [
          'SEED_PHRASE',
          'NEYNAR_API_KEY',
          'NEYNAR_CLIENT_ID',
          'SPONSOR_SIGNER',
        ];

        const envContent = fs.existsSync('.env')
          ? fs.readFileSync('.env', 'utf8') + '\n'
          : '';
        let newEnvContent = envContent;

        for (const [key, value] of Object.entries(localEnv)) {
          if (allowedVars.includes(key)) {
            process.env[key] = value;
            if (!envContent.includes(`${key}=`)) {
              newEnvContent += `${key}="${value}"\n`;
            }
          }
        }

        fs.writeFileSync('.env', newEnvContent);
        console.log('✅ Values from .env.local have been written to .env');
      }
    }
  } catch (error: unknown) {
    console.log('Note: No .env.local file found');
  }
}

async function checkRequiredEnvVars(): Promise<void> {
  console.log('\n📝 Checking environment variables...');
  console.log('Loading values from .env...');

  await loadEnvLocal();

  const requiredVars = [
    {
      name: 'NEXT_PUBLIC_MINI_APP_NAME',
      message: 'Enter the name for your frame (e.g., My Cool Mini App):',
      default: APP_NAME,
      validate: (input: string) =>
        input.trim() !== '' || 'Mini app name cannot be empty',
    },
    {
      name: 'NEXT_PUBLIC_MINI_APP_BUTTON_TEXT',
      message: 'Enter the text for your frame button:',
      default: APP_BUTTON_TEXT ?? 'Launch Mini App',
      validate: (input: string) =>
        input.trim() !== '' || 'Button text cannot be empty',
    },
  ];

  const missingVars = requiredVars.filter(
    varConfig => !process.env[varConfig.name],
  );

  if (missingVars.length > 0) {
    console.log("\n⚠️  Some required information is missing. Let's set it up:");
    for (const varConfig of missingVars) {
      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: varConfig.message,
          default: varConfig.default,
          validate: varConfig.validate,
        },
      ]);

      process.env[varConfig.name] = value;

      const envContent = fs.existsSync('.env')
        ? fs.readFileSync('.env', 'utf8')
        : '';

      if (!envContent.includes(`${varConfig.name}=`)) {
        const newLine = envContent ? '\n' : '';
        fs.appendFileSync(
          '.env',
          `${newLine}${varConfig.name}="${value.trim()}"`,
        );
      }
    }

    // Ask about SIWN if SEED_PHRASE is provided (moved outside the loop)
    if (process.env.SEED_PHRASE && !process.env.SPONSOR_SIGNER) {
      const { sponsorSigner } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'sponsorSigner',
          message:
            'You have provided a seed phrase, which enables Sign In With Neynar (SIWN).\n' +
            'Do you want to sponsor the signer? (This will be used in Sign In With Neynar)\n' +
            'Note: If you choose to sponsor the signer, Neynar will sponsor it for you and you will be charged in CUs.\n' +
            'For more information, see https://docs.neynar.com/docs/two-ways-to-sponsor-a-farcaster-signer-via-neynar#sponsor-signers',
          default: false,
        },
      ]);

      process.env.SPONSOR_SIGNER = sponsorSigner.toString();

      fs.appendFileSync(
        '.env.local',
        `\nSPONSOR_SIGNER="${sponsorSigner}"`,
      );
      console.log('✅ Sponsor signer preference stored in .env.local');
    }

    // Ask about required chains (moved outside the loop)
    const { useRequiredChains } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useRequiredChains',
        message:
          'Does your mini app require support for specific blockchains?\n' +
          'If yes, the host will only render your mini app if it supports all the chains you specify.\n' +
          'If no, the mini app will be rendered regardless of chain support.',
        default: false,
      },
    ]);

    let requiredChains: string[] = [];
    if (useRequiredChains) {
      const { selectedChains } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedChains',
          message: 'Select the required chains (CAIP-2 identifiers):',
          choices: [
            { name: 'Ethereum Mainnet (eip155:1)', value: 'eip155:1' },
            { name: 'Polygon (eip155:137)', value: 'eip155:137' },
            { name: 'Arbitrum One (eip155:42161)', value: 'eip155:42161' },
            { name: 'Optimism (eip155:10)', value: 'eip155:10' },
            { name: 'Base (eip155:8453)', value: 'eip155:8453' },
            { name: 'Solana (solana:mainnet)', value: 'solana:mainnet' },
            { name: 'Solana Devnet (solana:devnet)', value: 'solana:devnet' },
          ],
        },
      ]);
      requiredChains = selectedChains;
    }

    // Update constants.ts with required chains
    const constantsPath = path.join(projectRoot, 'src', 'lib', 'constants.ts');
    if (fs.existsSync(constantsPath)) {
      let constantsContent = fs.readFileSync(constantsPath, 'utf8');
      
      // Replace the APP_REQUIRED_CHAINS line
      const requiredChainsString = JSON.stringify(requiredChains);
      constantsContent = constantsContent.replace(
        /^export const APP_REQUIRED_CHAINS\s*:\s*string\[\]\s*=\s*\[[^\]]*\];$/m,
        `export const APP_REQUIRED_CHAINS: string[] = ${requiredChainsString};`,
      );
      
      fs.writeFileSync(constantsPath, constantsContent);
      console.log('✅ Required chains updated in constants.ts');
    }

    // Ask for account association
    console.log(
      `\n⚠️  To complete your mini app manifest, you need to sign it using the Farcaster developer portal.`,
    );
    console.log(
      '1. Go to: https://farcaster.xyz/~/developers/mini-apps/manifest',
    );
    console.log(
      '2. Enter your app domain (you\'ll get this after deployment)',
    );
    console.log(
      '3. Click "Transfer Ownership" and follow the instructions to sign the manifest.',
    );
    console.log(
      '4. Copy the resulting accountAssociation JSON.',
    );
    console.log('5. Paste it below when prompted.');
    console.log(
      '\nNote: If you don\'t have the accountAssociation yet, you can press Ctrl+C to skip and add it later.',
    );

    try {
      const { userAccountAssociation } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'userAccountAssociation',
          message: 'Paste the accountAssociation JSON here (or press Ctrl+C to skip):',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'You can press Ctrl+C to skip this step';
            }
            try {
              const parsed = JSON.parse(input);
              if (parsed.header && parsed.payload && parsed.signature) {
                return true;
              }
              return 'Invalid accountAssociation: must have header, payload, and signature';
            } catch (e) {
              return 'Invalid JSON';
            }
          },
        },
      ]);
      
      const parsedAccountAssociation = JSON.parse(userAccountAssociation);

      // Write APP_ACCOUNT_ASSOCIATION to constants.ts
      if (fs.existsSync(constantsPath)) {
        let constantsContent = fs.readFileSync(constantsPath, 'utf8');
        
        // Replace the APP_ACCOUNT_ASSOCIATION line
        const newAccountAssociation = `export const APP_ACCOUNT_ASSOCIATION: AccountAssociation | undefined = ${JSON.stringify(parsedAccountAssociation, null, 2)};`;
        constantsContent = constantsContent.replace(
          /^export const APP_ACCOUNT_ASSOCIATION\s*:\s*AccountAssociation \| undefined\s*=\s*[^;]*;/m,
          newAccountAssociation,
        );
        fs.writeFileSync(constantsPath, constantsContent);
        console.log('✅ APP_ACCOUNT_ASSOCIATION updated in constants.ts');
      }
    } catch (error) {
      console.log('\nℹ️  Skipping account association for now. You can add it later by updating APP_ACCOUNT_ASSOCIATION in src/lib/constants.ts');
    }
  }

  // Load SPONSOR_SIGNER from .env.local if SEED_PHRASE exists (SIWN enabled) but SPONSOR_SIGNER doesn't
  if (
    process.env.SEED_PHRASE &&
    !process.env.SPONSOR_SIGNER &&
    fs.existsSync('.env.local')
  ) {
    const localEnv = dotenv.parse(fs.readFileSync('.env.local'));
    if (localEnv.SPONSOR_SIGNER) {
      process.env.SPONSOR_SIGNER = localEnv.SPONSOR_SIGNER;
    }
  }
}

async function getGitRemote(): Promise<string | null> {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: projectRoot,
      encoding: 'utf8',
    }).trim();
    return remoteUrl;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return null;
    }
    throw error;
  }
}

async function checkVercelCLI(): Promise<boolean> {
  try {
    execSync('vercel --version', {
      stdio: 'ignore',
    });
    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return false;
    }
    throw error;
  }
}

async function installVercelCLI(): Promise<void> {
  console.log('Installing Vercel CLI...');
  execSync('npm install -g vercel', {
    stdio: 'inherit',
  });
}

async function getVercelToken(): Promise<string | null> {
  try {
    // Try to get token from Vercel CLI config
    const configPath = path.join(os.homedir(), '.vercel', 'auth.json');
    if (fs.existsSync(configPath)) {
      const authConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return authConfig.token;
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.warn('Could not read Vercel token from config file');
    }
  }

  // Try environment variable
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN;
  }

  // Try to extract from vercel whoami
  try {
    const whoamiOutput = execSync('vercel whoami', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    // If we can get whoami, we're logged in, but we need the actual token
    // The token isn't directly exposed, so we'll need to use CLI for some operations
    console.log('✅ Verified Vercel CLI authentication');
    return null; // We'll fall back to CLI operations
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(
        'Not logged in to Vercel CLI. Please run this script again to login.',
      );
    }
    throw error;
  }
}

async function loginToVercel(): Promise<boolean> {
  console.log('\n🔑 Vercel Login');
  console.log('You can either:');
  console.log('1. Log in to an existing Vercel account');
  console.log('2. Create a new Vercel account during login\n');
  console.log('If creating a new account:');
  console.log('1. Click "Continue with GitHub"');
  console.log('2. Authorize GitHub access');
  console.log('3. Complete the Vercel account setup in your browser');
  console.log('4. Return here once your Vercel account is created\n');
  console.log(
    '\nNote: you may need to cancel this script with ctrl+c and run it again if creating a new vercel account',
  );

  const child = spawn('vercel', ['login'], {
    stdio: 'inherit',
  });

  await new Promise<void>((resolve, reject) => {
    child.on('close', code => {
      resolve();
    });
  });

  console.log('\n📱 Waiting for login to complete...');
  console.log(
    "If you're creating a new account, please complete the Vercel account setup in your browser first.",
  );

  for (let i = 0; i < 150; i++) {
    try {
      execSync('vercel whoami', { stdio: 'ignore' });
      console.log('✅ Successfully logged in to Vercel!');
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('Account not found')
      ) {
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

async function setVercelEnvVarSDK(
  vercelClient: Vercel,
  projectId: string,
  key: string,
  value: string | object,
): Promise<boolean> {
  try {
    let processedValue: string;
    if (typeof value === 'object') {
      processedValue = JSON.stringify(value);
    } else {
      processedValue = value.toString();
    }

    // Get existing environment variables
    const existingVars = await vercelClient.projects.filterProjectEnvs({
      idOrName: projectId,
    });

    // Handle different response types
    let envs: any[] = [];
    if ('envs' in existingVars && Array.isArray(existingVars.envs)) {
      envs = existingVars.envs;
    } else if ('target' in existingVars && 'key' in existingVars) {
      // Single environment variable response
      envs = [existingVars];
    }

    const existingVar = envs.find(
      (env: any) => env.key === key && env.target?.includes('production'),
    );

    if (existingVar && existingVar.id) {
      // Update existing variable
      await vercelClient.projects.editProjectEnv({
        idOrName: projectId,
        id: existingVar.id,
        requestBody: {
          value: processedValue,
          target: ['production'],
        },
      });
      console.log(`✅ Updated environment variable: ${key}`);
    } else {
      // Create new variable
      await vercelClient.projects.createProjectEnv({
        idOrName: projectId,
        requestBody: {
          key: key,
          value: processedValue,
          type: 'encrypted',
          target: ['production'],
        },
      });
      console.log(`✅ Created environment variable: ${key}`);
    }

    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.warn(
        `⚠️  Warning: Failed to set environment variable ${key}:`,
        error.message,
      );
      return false;
    }
    throw error;
  }
}

async function setVercelEnvVarCLI(
  key: string,
  value: string | object,
  projectRoot: string,
): Promise<boolean> {
  try {
    // Remove existing env var
    try {
      execSync(`vercel env rm ${key} production -y`, {
        cwd: projectRoot,
        stdio: 'ignore',
        env: process.env,
      });
    } catch (error: unknown) {
      // Ignore errors from removal
    }

    let processedValue: string;
    if (typeof value === 'object') {
      processedValue = JSON.stringify(value);
    } else {
      processedValue = value.toString();
    }

    // Create temporary file
    const tempFilePath = path.join(projectRoot, `${key}_temp.txt`);
    fs.writeFileSync(tempFilePath, processedValue, 'utf8');

    // Use appropriate command based on platform
    let command: string;
    if (process.platform === 'win32') {
      command = `type "${tempFilePath}" | vercel env add ${key} production`;
    } else {
      command = `cat "${tempFilePath}" | vercel env add ${key} production`;
    }

    execSync(command, {
      cwd: projectRoot,
      stdio: 'pipe', // Changed from 'inherit' to avoid interactive prompts
      env: process.env,
    });

    fs.unlinkSync(tempFilePath);
    console.log(`✅ Set environment variable: ${key}`);
    return true;
  } catch (error: unknown) {
    const tempFilePath = path.join(projectRoot, `${key}_temp.txt`);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    if (error instanceof Error) {
      console.warn(
        `⚠️  Warning: Failed to set environment variable ${key}:`,
        error.message,
      );
      return false;
    }
    throw error;
  }
}

async function setEnvironmentVariables(
  vercelClient: Vercel | null,
  projectId: string | null,
  envVars: Record<string, string | object>,
  projectRoot: string,
): Promise<Array<{ key: string; success: boolean }>> {
  console.log('\n📝 Setting up environment variables...');

  const results: Array<{ key: string; success: boolean }> = [];

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
    console.warn(
      '\nYou may need to set these manually in the Vercel dashboard.',
    );
  }

  return results;
}

async function waitForDeployment(
  vercelClient: Vercel | null,
  projectId: string,
  maxWaitTime = 300000,
): Promise<any> {
  // 5 minutes
  console.log('\n⏳ Waiting for deployment to complete...');
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const deployments = await vercelClient?.deployments.getDeployments({
        projectId: projectId,
        limit: 1,
      });

      if (deployments?.deployments?.[0]) {
        const deployment = deployments.deployments[0];
        console.log(`📊 Deployment status: ${deployment.state}`);

        if (deployment.state === 'READY') {
          console.log('✅ Deployment completed successfully!');
          return deployment;
        } else if (deployment.state === 'ERROR') {
          throw new Error(`Deployment failed with state: ${deployment.state}`);
        } else if (deployment.state === 'CANCELED') {
          throw new Error('Deployment was canceled');
        }

        // Still building, wait and check again
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      } else {
        console.log('⏳ No deployment found yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.warn('⚠️  Could not check deployment status:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      throw error;
    }
  }

  throw new Error('Deployment timed out after 5 minutes');
}

async function deployToVercel(useGitHub = false): Promise<void> {
  try {
    console.log('\n🚀 Deploying to Vercel...');

    // Ensure vercel.json exists
    const vercelConfigPath = path.join(projectRoot, 'vercel.json');
    if (!fs.existsSync(vercelConfigPath)) {
      console.log('📝 Creating vercel.json configuration...');
      fs.writeFileSync(
        vercelConfigPath,
        JSON.stringify(
          {
            buildCommand: 'next build',
            framework: 'nextjs',
          },
          null,
          2,
        ),
      );
    }

    // Set up Vercel project
    console.log('\n📦 Setting up Vercel project...');
    console.log(
      'An initial deployment is required to get an assigned domain that can be used in the mini app manifest\n',
    );
    console.log(
      '\n⚠️ Note: choosing a longer, more unique project name will help avoid conflicts with other existing domains\n',
    );

    // Use spawn instead of execSync for better error handling
    const { spawn } = await import('child_process');
    const vercelSetup = spawn('vercel', [], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32' ? true : undefined,
    });

    await new Promise<void>((resolve, reject) => {
      vercelSetup.on('close', code => {
        if (code === 0 || code === null) {
          console.log('✅ Vercel project setup completed');
          resolve();
        } else {
          console.log('⚠️  Vercel setup command completed (this is normal)');
          resolve(); // Don't reject, as this is often expected
        }
      });

      vercelSetup.on('error', error => {
        console.log('⚠️  Vercel setup command completed (this is normal)');
        resolve(); // Don't reject, as this is often expected
      });
    });

    // Wait a moment for project files to be written
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load project info
    let projectId: string;
    try {
      const projectJson = JSON.parse(
        fs.readFileSync('.vercel/project.json', 'utf8'),
      );
      projectId = projectJson.projectId;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          'Failed to load project info. Please ensure the Vercel project was created successfully.',
        );
      }
      throw error;
    }

    // Get Vercel token and initialize SDK client
    let vercelClient: Vercel | null = null;
    try {
      const token = await getVercelToken();
      if (token) {
        vercelClient = new Vercel({
          bearerToken: token,
        });
        console.log('✅ Initialized Vercel SDK client');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.warn(
          '⚠️  Could not initialize Vercel SDK, falling back to CLI operations',
        );
      }
      throw error;
    }

    // Get project details
    console.log('\n🔍 Getting project details...');
    let domain: string | undefined;
    let projectName: string | undefined;

    if (vercelClient) {
      try {
        const projects = await vercelClient.projects.getProjects({});
        const project = projects.projects.find(
          (p: any) => p.id === projectId || p.name === projectId,
        );
        if (project) {
          projectName = project.name;
          domain = `${projectName}.vercel.app`;
          console.log('🌐 Using project name for domain:', domain);
        } else {
          throw new Error('Project not found');
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.warn(
            '⚠️  Could not get project details via SDK, using CLI fallback',
          );
        }
        throw error;
      }
    }

    // Fallback to CLI method if SDK failed
    if (!domain) {
      try {
        const inspectOutput = execSync(
          `vercel project inspect ${projectId} 2>&1`,
          {
            cwd: projectRoot,
            encoding: 'utf8',
          },
        );

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
            console.warn(
              '⚠️  Could not determine project name from inspection, using fallback',
            );
            // Use a fallback domain based on project ID
            domain = `project-${projectId.slice(-8)}.vercel.app`;
            console.log('🌐 Using fallback domain:', domain);
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.warn('⚠️  Could not inspect project, using fallback domain');
          // Use a fallback domain based on project ID
          domain = `project-${projectId.slice(-8)}.vercel.app`;
          console.log('🌐 Using fallback domain:', domain);
        }
        throw error;
      }
    }

    // Prepare environment variables
    const nextAuthSecret =
      process.env.NEXTAUTH_SECRET || crypto.randomBytes(32).toString('hex');
    const vercelEnv = {
      NEXT_PUBLIC_URL: `https://${domain}`,

      ...(process.env.NEYNAR_API_KEY && {
        NEYNAR_API_KEY: process.env.NEYNAR_API_KEY,
      }),
      ...(process.env.NEYNAR_CLIENT_ID && {
        NEYNAR_CLIENT_ID: process.env.NEYNAR_CLIENT_ID,
      }),
      ...(process.env.SPONSOR_SIGNER && {
        SPONSOR_SIGNER: process.env.SPONSOR_SIGNER,
      }),

      // Include NextAuth environment variables if SEED_PHRASE is present (SIWN enabled)
      ...(process.env.SEED_PHRASE && {
        SEED_PHRASE: process.env.SEED_PHRASE,
        NEXTAUTH_SECRET: nextAuthSecret,
        AUTH_SECRET: nextAuthSecret,
        NEXTAUTH_URL: `https://${domain}`,
      }),

      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          key.startsWith('NEXT_PUBLIC_'),
        ),
      ),
    };

    // Set environment variables
    await setEnvironmentVariables(
      vercelClient,
      projectId,
      vercelEnv,
      projectRoot,
    );

    // Deploy the project
    if (useGitHub) {
      console.log('\nSetting up GitHub integration...');
      execSync('vercel link', {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
      });
      console.log('\n📦 Deploying with GitHub integration...');
    } else {
      console.log('\n📦 Deploying local code directly...');
    }

    // Use spawn for better control over the deployment process
    const vercelDeploy = spawn('vercel', ['deploy', '--prod'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    });

    await new Promise<void>((resolve, reject) => {
      vercelDeploy.on('close', code => {
        if (code === 0) {
          console.log('✅ Vercel deployment command completed');
          resolve();
        } else {
          console.error(`❌ Vercel deployment failed with code: ${code}`);
          reject(new Error(`Vercel deployment failed with exit code: ${code}`));
        }
      });

      vercelDeploy.on('error', error => {
        console.error('❌ Vercel deployment error:', error.message);
        reject(error);
      });
    });

    // Wait for deployment to actually complete
    let deployment: any;
    if (vercelClient) {
      try {
        deployment = await waitForDeployment(vercelClient, projectId);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.warn(
            '⚠️  Could not verify deployment completion:',
            error.message,
          );
          console.log('ℹ️  Proceeding with domain verification...');
        }
        throw error;
      }
    }

    // Verify actual domain after deployment
    console.log('\n🔍 Verifying deployment domain...');

    let actualDomain = domain;
    if (vercelClient && deployment) {
      try {
        actualDomain = deployment.url || domain;
        console.log('🌐 Verified actual domain:', actualDomain);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.warn(
            '⚠️  Could not verify domain via SDK, using assumed domain',
          );
        }
        throw error;
      }
    }

    // Update environment variables if domain changed
    if (actualDomain !== domain) {
      console.log('🔄 Updating environment variables with correct domain...');

      const updatedEnv: Record<string, string | object> = {
        NEXT_PUBLIC_URL: `https://${actualDomain}`,
      };

      // Include NextAuth URL if SEED_PHRASE is present (SIWN enabled)
      if (process.env.SEED_PHRASE) {
        updatedEnv.NEXTAUTH_URL = `https://${actualDomain}`;
      }

      await setEnvironmentVariables(
        vercelClient,
        projectId,
        updatedEnv,
        projectRoot,
      );

      console.log('\n📦 Redeploying with correct domain...');
      const vercelRedeploy = spawn('vercel', ['deploy', '--prod'], {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
      });

      await new Promise<void>((resolve, reject) => {
        vercelRedeploy.on('close', code => {
          if (code === 0) {
            console.log('✅ Redeployment completed');
            resolve();
          } else {
            console.error(`❌ Redeployment failed with code: ${code}`);
            reject(new Error(`Redeployment failed with exit code: ${code}`));
          }
        });

        vercelRedeploy.on('error', error => {
          console.error('❌ Redeployment error:', error.message);
          reject(error);
        });
      });

      domain = actualDomain;
    }

    console.log('\n✨ Deployment complete! Your mini app is now live at:');
    console.log(`🌐 https://${domain}`);
    console.log(
      '\n📝 You can manage your project at https://vercel.com/dashboard',
    );
    
    // Remind user about account association if not already set
    console.log(
      `\n💡 Remember: If you haven't already signed your manifest, go to:`,
    );
    console.log(
      `   https://farcaster.xyz/~/developers/mini-apps/manifest?domain=${domain}`,
    );
    console.log(
      '   to complete the ownership transfer and update APP_ACCOUNT_ASSOCIATION in src/lib/constants.ts',
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('\n❌ Deployment failed:', error.message);
      process.exit(1);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Vercel Mini App Deployment (SDK Edition)');
    console.log(
      'This script will deploy your mini app to Vercel using the Vercel SDK.',
    );
    console.log('\nThe script will:');
    console.log('1. Check for required environment variables');
    console.log('2. Set up a Vercel project (new or existing)');
    console.log('3. Configure environment variables in Vercel using SDK');
    console.log('4. Deploy and build your mini app\n');

    // Check if @vercel/sdk is installed
    try {
      await import('@vercel/sdk');
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('📦 Installing @vercel/sdk...');
        execSync('npm install @vercel/sdk', {
          cwd: projectRoot,
          stdio: 'inherit',
        });
        console.log('✅ @vercel/sdk installed successfully');
      }
      throw error;
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
          default: true,
        },
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
            { name: 'Set up GitHub repository first', value: 'setup' },
          ],
          default: 'deploy',
        },
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

    if (!(await checkVercelCLI())) {
      console.log('Vercel CLI not found. Installing...');
      await installVercelCLI();
    }

    if (!(await loginToVercel())) {
      console.error('\n❌ Failed to log in to Vercel. Please try again.');
      process.exit(1);
    }

    await deployToVercel(useGitHub);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
    throw error;
  }
}

main();