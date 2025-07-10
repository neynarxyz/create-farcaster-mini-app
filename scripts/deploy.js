import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import dotenv from "dotenv";
import crypto from "crypto";
import { Vercel } from "@vercel/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// Load environment variables in specific order
dotenv.config({ path: ".env" });

async function generateFarcasterMetadata(domain, webhookUrl) {
  const trimmedDomain = domain.trim();
  const tags = process.env.NEXT_PUBLIC_MINI_APP_TAGS?.split(",");

  return {
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
    if (fs.existsSync(".env.local")) {
      const { loadLocal } = await inquirer.prompt([
        {
          type: "confirm",
          name: "loadLocal",
          message:
            "Found .env.local - would you like to load its values in addition to .env values?",
          default: true,
        },
      ]);

      if (loadLocal) {
        console.log("Loading values from .env.local...");
        const localEnv = dotenv.parse(fs.readFileSync(".env.local"));

        const allowedVars = [
          "NEXT_PUBLIC_MINI_APP_NAME",
          "NEXT_PUBLIC_MINI_APP_DESCRIPTION",
          "NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY",
          "NEXT_PUBLIC_MINI_APP_TAGS",
          "NEXT_PUBLIC_MINI_APP_BUTTON_TEXT",
          "NEXT_PUBLIC_ANALYTICS_ENABLED",
          "NEYNAR_API_KEY",
          "NEYNAR_CLIENT_ID",
        ];

        const envContent = fs.existsSync(".env")
          ? fs.readFileSync(".env", "utf8") + "\n"
          : "";
        let newEnvContent = envContent;

        for (const [key, value] of Object.entries(localEnv)) {
          if (allowedVars.includes(key)) {
            process.env[key] = value;
            if (!envContent.includes(`${key}=`)) {
              newEnvContent += `${key}="${value}"\n`;
            }
          }
        }

        fs.writeFileSync(".env", newEnvContent);
        console.log("✅ Values from .env.local have been written to .env");
      }
    }
  } catch (error) {
    console.log("Note: No .env.local file found");
  }
}

async function checkRequiredEnvVars() {
  console.log("\n📝 Checking environment variables...");
  console.log("Loading values from .env...");

  await loadEnvLocal();

  const requiredVars = [
    {
      name: "NEXT_PUBLIC_MINI_APP_NAME",
      message: "Enter the name for your frame (e.g., My Cool Mini App):",
      default: process.env.NEXT_PUBLIC_MINI_APP_NAME,
      validate: (input) =>
        input.trim() !== "" || "Mini app name cannot be empty",
    },
    {
      name: "NEXT_PUBLIC_MINI_APP_BUTTON_TEXT",
      message: "Enter the text for your frame button:",
      default:
        process.env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT ?? "Launch Mini App",
      validate: (input) => input.trim() !== "" || "Button text cannot be empty",
    },
  ];

  const missingVars = requiredVars.filter(
    (varConfig) => !process.env[varConfig.name]
  );

  if (missingVars.length > 0) {
    console.log("\n⚠️  Some required information is missing. Let's set it up:");
    for (const varConfig of missingVars) {
      const { value } = await inquirer.prompt([
        {
          type: "input",
          name: "value",
          message: varConfig.message,
          default: varConfig.default,
          validate: varConfig.validate,
        },
      ]);

      process.env[varConfig.name] = value;

      const envContent = fs.existsSync(".env")
        ? fs.readFileSync(".env", "utf8")
        : "";

      if (!envContent.includes(`${varConfig.name}=`)) {
        const newLine = envContent ? "\n" : "";
        fs.appendFileSync(
          ".env",
          `${newLine}${varConfig.name}="${value.trim()}"`
        );
      }
    }
  }
}

async function getGitRemote() {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    return remoteUrl;
  } catch (error) {
    return null;
  }
}

async function checkVercelCLI() {
  try {
    execSync("vercel --version", {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function installVercelCLI() {
  console.log("Installing Vercel CLI...");
  execSync("npm install -g vercel", {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

async function getVercelToken() {
  try {
    // Try to get token from Vercel CLI config
    const configPath = path.join(os.homedir(), ".vercel", "auth.json");
    if (fs.existsSync(configPath)) {
      const authConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return authConfig.token;
    }
  } catch (error) {
    console.warn("Could not read Vercel token from config file");
  }

  // Try environment variable
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN;
  }

  // Try to extract from vercel whoami
  try {
    const whoamiOutput = execSync("vercel whoami", {
      encoding: "utf8",
      stdio: "pipe",
    });

    // If we can get whoami, we're logged in, but we need the actual token
    // The token isn't directly exposed, so we'll need to use CLI for some operations
    console.log("✅ Verified Vercel CLI authentication");
    return null; // We'll fall back to CLI operations
  } catch (error) {
    throw new Error(
      "Not logged in to Vercel CLI. Please run this script again to login."
    );
  }
}

async function loginToVercel() {
  console.log("\n🔑 Vercel Login");
  console.log("You can either:");
  console.log("1. Log in to an existing Vercel account");
  console.log("2. Create a new Vercel account during login\n");
  console.log("If creating a new account:");
  console.log('1. Click "Continue with GitHub"');
  console.log("2. Authorize GitHub access");
  console.log("3. Complete the Vercel account setup in your browser");
  console.log("4. Return here once your Vercel account is created\n");
  console.log(
    "\nNote: you may need to cancel this script with ctrl+c and run it again if creating a new vercel account"
  );

  const child = spawn("vercel", ["login"], {
    stdio: "inherit",
  });

  await new Promise((resolve, reject) => {
    child.on("close", (code) => {
      resolve();
    });
  });

  console.log("\n📱 Waiting for login to complete...");
  console.log(
    "If you're creating a new account, please complete the Vercel account setup in your browser first."
  );

  for (let i = 0; i < 150; i++) {
    try {
      execSync("vercel whoami", { stdio: "ignore" });
      console.log("✅ Successfully logged in to Vercel!");
      return true;
    } catch (error) {
      if (error.message.includes("Account not found")) {
        console.log("ℹ️  Waiting for Vercel account setup to complete...");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.error("\n❌ Login timed out. Please ensure you have:");
  console.error("1. Completed the Vercel account setup in your browser");
  console.error("2. Authorized the GitHub integration");
  console.error("Then try running this script again.");
  return false;
}

async function setVercelEnvVarSDK(vercelClient, projectId, key, value) {
  try {
    let processedValue;
    if (typeof value === "object") {
      processedValue = JSON.stringify(value);
    } else {
      processedValue = value.toString();
    }

    // Get existing environment variables
    const existingVars = await vercelClient.projects.getEnvironmentVariables({
      idOrName: projectId,
    });

    const existingVar = existingVars.envs?.find(
      (env) => env.key === key && env.target?.includes("production")
    );

    if (existingVar) {
      // Update existing variable
      await vercelClient.projects.editEnvironmentVariable({
        idOrName: projectId,
        id: existingVar.id,
        requestBody: {
          value: processedValue,
          target: ["production"],
        },
      });
      console.log(`✅ Updated environment variable: ${key}`);
    } else {
      // Create new variable
      await vercelClient.projects.createEnvironmentVariable({
        idOrName: projectId,
        requestBody: {
          key: key,
          value: processedValue,
          type: "encrypted",
          target: ["production"],
        },
      });
      console.log(`✅ Created environment variable: ${key}`);
    }

    return true;
  } catch (error) {
    console.warn(
      `⚠️  Warning: Failed to set environment variable ${key}:`,
      error.message
    );
    return false;
  }
}

async function setVercelEnvVarCLI(key, value, projectRoot) {
  try {
    // Remove existing env var
    try {
      execSync(`vercel env rm ${key} production -y`, {
        cwd: projectRoot,
        stdio: "ignore",
        env: process.env,
      });
    } catch (error) {
      // Ignore errors from removal
    }

    let processedValue;
    if (typeof value === "object") {
      processedValue = JSON.stringify(value);
    } else {
      processedValue = value.toString();
    }

    // Create temporary file
    const tempFilePath = path.join(projectRoot, `${key}_temp.txt`);
    fs.writeFileSync(tempFilePath, processedValue, "utf8");

    // Use appropriate command based on platform
    let command;
    if (process.platform === "win32") {
      command = `type "${tempFilePath}" | vercel env add ${key} production`;
    } else {
      command = `cat "${tempFilePath}" | vercel env add ${key} production`;
    }

    execSync(command, {
      cwd: projectRoot,
      stdio: "pipe", // Changed from 'inherit' to avoid interactive prompts
      shell: true,
      env: process.env,
    });

    fs.unlinkSync(tempFilePath);
    console.log(`✅ Set environment variable: ${key}`);
    return true;
  } catch (error) {
    const tempFilePath = path.join(projectRoot, `${key}_temp.txt`);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    console.warn(
      `⚠️  Warning: Failed to set environment variable ${key}:`,
      error.message
    );
    return false;
  }
}

async function setEnvironmentVariables(
  vercelClient,
  projectId,
  envVars,
  projectRoot
) {
  console.log("\n📝 Setting up environment variables...");

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
  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.warn(`\n⚠️  Failed to set ${failed.length} environment variables:`);
    failed.forEach((r) => console.warn(`   - ${r.key}`));
    console.warn(
      "\nYou may need to set these manually in the Vercel dashboard."
    );
  }

  return results;
}

async function waitForDeployment(vercelClient, projectId, maxWaitTime = 300000) { // 5 minutes
  console.log('\n⏳ Waiting for deployment to complete...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const deployments = await vercelClient.deployments.list({
        projectId: projectId,
        limit: 1
      });
      
      if (deployments.deployments?.[0]) {
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
    } catch (error) {
      console.warn('⚠️  Could not check deployment status:', error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Deployment timed out after 5 minutes');
}

async function deployToVercel(useGitHub = false) {
  try {
    console.log("\n🚀 Deploying to Vercel...");

    // Ensure vercel.json exists
    const vercelConfigPath = path.join(projectRoot, "vercel.json");
    if (!fs.existsSync(vercelConfigPath)) {
      console.log("📝 Creating vercel.json configuration...");
      fs.writeFileSync(
        vercelConfigPath,
        JSON.stringify(
          {
            buildCommand: "next build",
            framework: "nextjs",
          },
          null,
          2
        )
      );
    }

    // Set up Vercel project
    console.log('\n📦 Setting up Vercel project...');
    console.log('An initial deployment is required to get an assigned domain that can be used in the mini app manifest\n');
    console.log('\n⚠️ Note: choosing a longer, more unique project name will help avoid conflicts with other existing domains\n');
    
    // Use spawn instead of execSync for better error handling
    const { spawn } = await import('child_process');
    const vercelSetup = spawn('vercel', [], { 
      cwd: projectRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    await new Promise((resolve, reject) => {
      vercelSetup.on('close', (code) => {
        if (code === 0 || code === null) {
          console.log('✅ Vercel project setup completed');
          resolve();
        } else {
          console.log('⚠️  Vercel setup command completed (this is normal)');
          resolve(); // Don't reject, as this is often expected
        }
      });
      
      vercelSetup.on('error', (error) => {
        console.log('⚠️  Vercel setup command completed (this is normal)');
        resolve(); // Don't reject, as this is often expected
      });
    });

    // Wait a moment for project files to be written
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load project info
    let projectId;
    try {
      const projectJson = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
      projectId = projectJson.projectId;
    } catch (error) {
      throw new Error('Failed to load project info. Please ensure the Vercel project was created successfully.');
    }

    // Get Vercel token and initialize SDK client
    let vercelClient = null;
    try {
      const token = await getVercelToken();
      if (token) {
        vercelClient = new Vercel({
          bearerToken: token,
        });
        console.log("✅ Initialized Vercel SDK client");
      }
    } catch (error) {
      console.warn(
        "⚠️  Could not initialize Vercel SDK, falling back to CLI operations"
      );
    }

    // Get project details
    console.log("\n🔍 Getting project details...");
    let domain;
    let projectName;

    if (vercelClient) {
      try {
        const project = await vercelClient.projects.get({
          idOrName: projectId,
        });
        projectName = project.name;
        domain = `${projectName}.vercel.app`;
        console.log("🌐 Using project name for domain:", domain);
      } catch (error) {
        console.warn(
          "⚠️  Could not get project details via SDK, using CLI fallback"
        );
      }
    }

    // Fallback to CLI method if SDK failed
    if (!domain) {
      try {
        const inspectOutput = execSync(`vercel project inspect ${projectId} 2>&1`, {
          cwd: projectRoot,
          encoding: 'utf8'
        });

        const nameMatch = inspectOutput.match(/Name\s+([^\n]+)/);
        if (nameMatch) {
          projectName = nameMatch[1].trim();
          domain = `${projectName}.vercel.app`;
          console.log("🌐 Using project name for domain:", domain);
        } else {
          const altMatch = inspectOutput.match(/Found Project [^/]+\/([^\n]+)/);
          if (altMatch) {
            projectName = altMatch[1].trim();
            domain = `${projectName}.vercel.app`;
            console.log('🌐 Using project name for domain:', domain);
          } else {
            console.warn('⚠️  Could not determine project name from inspection, using fallback');
            // Use a fallback domain based on project ID
            domain = `project-${projectId.slice(-8)}.vercel.app`;
            console.log('🌐 Using fallback domain:', domain);
          }
        }
      } catch (error) {
        console.warn('⚠️  Could not inspect project, using fallback domain');
        // Use a fallback domain based on project ID
        domain = `project-${projectId.slice(-8)}.vercel.app`;
        console.log('🌐 Using fallback domain:', domain);
      }
    }

    // Generate mini app metadata
    console.log("\n🔨 Generating mini app metadata...");

    const webhookUrl =
      process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID
        ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
        : `https://${domain}/api/webhook`;

    const miniAppMetadata = await generateFarcasterMetadata(domain, webhookUrl);
    console.log("✅ Mini app metadata generated");

    // Prepare environment variables
    const nextAuthSecret =
      process.env.NEXTAUTH_SECRET || crypto.randomBytes(32).toString("hex");
    const vercelEnv = {
      NEXTAUTH_SECRET: nextAuthSecret,
      AUTH_SECRET: nextAuthSecret,
      NEXTAUTH_URL: `https://${domain}`,
      NEXT_PUBLIC_URL: `https://${domain}`,

      ...(process.env.NEYNAR_API_KEY && {
        NEYNAR_API_KEY: process.env.NEYNAR_API_KEY,
      }),
      ...(process.env.NEYNAR_CLIENT_ID && {
        NEYNAR_CLIENT_ID: process.env.NEYNAR_CLIENT_ID,
      }),
      ...(miniAppMetadata && { MINI_APP_METADATA: miniAppMetadata }),

      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          key.startsWith("NEXT_PUBLIC_")
        )
      ),
    };

    // Set environment variables
    await setEnvironmentVariables(
      vercelClient,
      projectId,
      vercelEnv,
      projectRoot
    );

    // Deploy the project
    if (useGitHub) {
      console.log("\nSetting up GitHub integration...");
      execSync("vercel link", {
        cwd: projectRoot,
        stdio: "inherit",
        env: process.env,
      });
      console.log("\n📦 Deploying with GitHub integration...");
    } else {
      console.log("\n📦 Deploying local code directly...");
    }

    // Use spawn for better control over the deployment process
    const vercelDeploy = spawn('vercel', ['deploy', '--prod'], { 
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });

    await new Promise((resolve, reject) => {
      vercelDeploy.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Vercel deployment command completed');
          resolve();
        } else {
          console.error(`❌ Vercel deployment failed with code: ${code}`);
          reject(new Error(`Vercel deployment failed with exit code: ${code}`));
        }
      });
      
      vercelDeploy.on('error', (error) => {
        console.error('❌ Vercel deployment error:', error.message);
        reject(error);
      });
    });

    // Wait for deployment to actually complete
    let deployment;
    if (vercelClient) {
      try {
        deployment = await waitForDeployment(vercelClient, projectId);
      } catch (error) {
        console.warn('⚠️  Could not verify deployment completion:', error.message);
        console.log('ℹ️  Proceeding with domain verification...');
      }
    }

    // Verify actual domain after deployment
    console.log("\n🔍 Verifying deployment domain...");

    let actualDomain = domain;
    if (vercelClient && deployment) {
      try {
        actualDomain = deployment.url || domain;
        console.log('🌐 Verified actual domain:', actualDomain);
      } catch (error) {
        console.warn(
          "⚠️  Could not verify domain via SDK, using assumed domain"
        );
      }
    }

    // Update environment variables if domain changed
    if (actualDomain !== domain) {
      console.log("🔄 Updating environment variables with correct domain...");

      const webhookUrl =
        process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID
          ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
          : `https://${actualDomain}/api/webhook`;

      const updatedEnv = {
        NEXTAUTH_URL: `https://${actualDomain}`,
        NEXT_PUBLIC_URL: `https://${actualDomain}`,
      };

      if (miniAppMetadata) {
        const updatedMetadata = await generateFarcasterMetadata(actualDomain, fid, await validateSeedPhrase(process.env.SEED_PHRASE), process.env.SEED_PHRASE, webhookUrl);
        updatedEnv.MINI_APP_METADATA = updatedMetadata;
      }

      await setEnvironmentVariables(vercelClient, projectId, updatedEnv, projectRoot);

      console.log('\n📦 Redeploying with correct domain...');
      const vercelRedeploy = spawn('vercel', ['deploy', '--prod'], { 
        cwd: projectRoot,
        stdio: "inherit",
        env: process.env,
      });

      await new Promise((resolve, reject) => {
        vercelRedeploy.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Redeployment completed');
            resolve();
          } else {
            console.error(`❌ Redeployment failed with code: ${code}`);
            reject(new Error(`Redeployment failed with exit code: ${code}`));
          }
        });
        
        vercelRedeploy.on('error', (error) => {
          console.error('❌ Redeployment error:', error.message);
          reject(error);
        });
      });
      
      domain = actualDomain;
    }

    console.log("\n✨ Deployment complete! Your mini app is now live at:");
    console.log(`🌐 https://${domain}`);
    console.log(
      "\n📝 You can manage your project at https://vercel.com/dashboard"
    );
  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    console.log("🚀 Vercel Mini App Deployment (SDK Edition)");
    console.log(
      "This script will deploy your mini app to Vercel using the Vercel SDK."
    );
    console.log("\nThe script will:");
    console.log("1. Check for required environment variables");
    console.log("2. Set up a Vercel project (new or existing)");
    console.log("3. Configure environment variables in Vercel using SDK");
    console.log("4. Deploy and build your mini app\n");

    // Check if @vercel/sdk is installed
    try {
      await import("@vercel/sdk");
    } catch (error) {
      console.log("📦 Installing @vercel/sdk...");
      execSync("npm install @vercel/sdk", {
        cwd: projectRoot,
        stdio: "inherit",
      });
      console.log("✅ @vercel/sdk installed successfully");
    }

    await checkRequiredEnvVars();

    const remoteUrl = await getGitRemote();
    let useGitHub = false;

    if (remoteUrl) {
      console.log("\n📦 Found GitHub repository:", remoteUrl);
      const { useGitHubDeploy } = await inquirer.prompt([
        {
          type: "confirm",
          name: "useGitHubDeploy",
          message: "Would you like to deploy from the GitHub repository?",
          default: true,
        },
      ]);
      useGitHub = useGitHubDeploy;
    } else {
      console.log("\n⚠️  No GitHub repository found.");
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Deploy local code directly", value: "deploy" },
            { name: "Set up GitHub repository first", value: "setup" },
          ],
          default: "deploy",
        },
      ]);

      if (action === "setup") {
        console.log("\n👋 Please set up your GitHub repository first:");
        console.log("1. Create a new repository on GitHub");
        console.log("2. Run these commands:");
        console.log("   git remote add origin <your-repo-url>");
        console.log("   git push -u origin main");
        console.log("\nThen run this script again to deploy.");
        process.exit(0);
      }
    }

    if (!(await checkVercelCLI())) {
      console.log("Vercel CLI not found. Installing...");
      await installVercelCLI();
    }

    if (!(await loginToVercel())) {
      console.error("\n❌ Failed to log in to Vercel. Please try again.");
      process.exit(1);
    }

    await deployToVercel(useGitHub);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
