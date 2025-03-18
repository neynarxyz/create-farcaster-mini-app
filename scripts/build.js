import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { mnemonicToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: true });

// TODO: validate this file
// TODO: add other stuff to .env necessary for prod deployment
// TODO: update app to use saved manifest from .env if not running in dev mode

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

async function validateDomain(domain) {
  // Remove http:// or https:// if present
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  
  // Basic domain validation
  if (!cleanDomain.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/)) {
    throw new Error('Invalid domain format');
  }

  return cleanDomain;
}

async function validateSeedPhrase(seedPhrase) {
  try {
    // Try to create an account from the seed phrase
    const account = mnemonicToAccount(seedPhrase);
    console.log('✅ Seed phrase validated successfully');
    return account.address;
  } catch (error) {
    throw new Error('Invalid seed phrase');
  }
}

async function generateFarcasterMetadata(domain, accountAddress, seedPhrase) {
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
      name: process.env.NEXT_PUBLIC_FRAME_NAME || "Frames v2 Demo",
      iconUrl: `${domain}/icon.png`,
      homeUrl: domain,
      imageUrl: `${domain}/opengraph-image`,
      buttonTitle: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || "Launch Frame",
      splashImageUrl: `${domain}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl: `${domain}/api/webhook`,
    },
  };
}

async function main() {
  try {
    // Get domain from user
    const { domain } = await inquirer.prompt([
      {
        type: 'input',
        name: 'domain',
        message: 'Enter the domain where your frame will be deployed (e.g., example.com):',
        validate: async (input) => {
          try {
            await validateDomain(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      }
    ]);

    // Get frame name from user
    const { frameName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'frameName',
        message: 'Enter the name for your frame (e.g., My Cool Frame):',
        default: process.env.NEXT_PUBLIC_FRAME_NAME || 'Frames v2 Demo',
        validate: (input) => {
          if (input.trim() === '') {
            return 'Frame name cannot be empty';
          }
          return true;
        }
      }
    ]);

    // Get button text from user
    const { buttonText } = await inquirer.prompt([
      {
        type: 'input',
        name: 'buttonText',
        message: 'Enter the text for your frame button (e.g., Launch Frame):',
        default: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || 'Launch Frame',
        validate: (input) => {
          if (input.trim() === '') {
            return 'Button text cannot be empty';
          }
          return true;
        }
      }
    ]);

    // Get seed phrase from user
    const { seedPhrase } = await inquirer.prompt([
      {
        type: 'password',
        name: 'seedPhrase',
        message: 'Enter your seed phrase (this will only be used to sign the frame manifest):',
        validate: async (input) => {
          try {
            await validateSeedPhrase(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      }
    ]);

    // Validate seed phrase and get account address
    const accountAddress = await validateSeedPhrase(seedPhrase);
    console.log('✅ Seed phrase validated successfully');

    // Generate and sign manifest
    console.log('\n🔨 Generating frame manifest...');
    const metadata = await generateFarcasterMetadata(domain, accountAddress, seedPhrase);
    console.log('\n✅ Frame manifest generated' + (seedPhrase ? ' and signed' : ''));

    // Read existing .env file or create new one
    const envPath = path.join(projectRoot, '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    // Add or update environment variables
    const newEnvVars = [
      // Base URL
      `NEXT_PUBLIC_URL=https://${domain}`,

      // Frame metadata
      `NEXT_PUBLIC_FRAME_NAME="${frameName}"`,
      `NEXT_PUBLIC_FRAME_DESCRIPTION="${process.env.NEXT_PUBLIC_FRAME_DESCRIPTION || ''}"`,
      `NEXT_PUBLIC_FRAME_BUTTON_TEXT="${buttonText}"`,

      // Image URLs (if they exist in current env)
      ...(process.env.NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL ? 
        [`NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL="${process.env.NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL}"`] : []),
      ...(process.env.NEXT_PUBLIC_FRAME_ICON_IMAGE_URL ? 
        [`NEXT_PUBLIC_FRAME_ICON_IMAGE_URL="${process.env.NEXT_PUBLIC_FRAME_ICON_IMAGE_URL}"`] : []),

      // Neynar configuration (if it exists in current env)
      ...(process.env.NEYNAR_API_KEY ? 
        [`NEYNAR_API_KEY="${process.env.NEYNAR_API_KEY}"`] : []),
      ...(process.env.NEYNAR_CLIENT_ID ? 
        [`NEYNAR_CLIENT_ID="${process.env.NEYNAR_CLIENT_ID}"`] : []),

      // FID (if it exists in current env)
      ...(process.env.FID ? [`FID="${process.env.FID}"`] : []),

      // Frame manifest with signature
      `FRAME_METADATA=${JSON.stringify(metadata)}`,
    ];

    // Filter out empty values and join with newlines
    const validEnvVars = newEnvVars.filter(line => {
      const [, value] = line.split('=');
      return value && value !== '""';
    });

    // Update or append each environment variable
    validEnvVars.forEach(varLine => {
      const [key] = varLine.split('=');
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(new RegExp(`${key}=.*`), varLine);
      } else {
        envContent += `\n${varLine}`;
      }
    });

    // Write updated .env file
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Environment variables updated');

    // Run next build
    console.log('\nBuilding Next.js application...');
    execSync('next build', { cwd: projectRoot, stdio: 'inherit' });

    console.log('\n✨ Build complete! Your frame is ready for deployment. 🪐');
    console.log('📝 Make sure to configure the environment variables from .env in your hosting provider');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
