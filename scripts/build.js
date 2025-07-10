import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import dotenv from "dotenv";
import crypto from "crypto";

// Load environment variables in specific order
// First load .env for main config
dotenv.config({ path: ".env" });

async function loadEnvLocal() {
  try {
    if (fs.existsSync(".env.local")) {
      const { loadLocal } = await inquirer.prompt([
        {
          type: "confirm",
          name: "loadLocal",
          message:
            "Found .env.local, likely created by the install script - would you like to load its values?",
          default: false,
        },
      ]);

      if (loadLocal) {
        console.log("Loading values from .env.local...");
        const localEnv = dotenv.parse(fs.readFileSync(".env.local"));

        // Copy all values to .env
        const envContent = fs.existsSync(".env")
          ? fs.readFileSync(".env", "utf8") + "\n"
          : "";
        let newEnvContent = envContent;

        for (const [key, value] of Object.entries(localEnv)) {
          // Update process.env
          process.env[key] = value;
          // Add to .env content if not already there
          if (!envContent.includes(`${key}=`)) {
            newEnvContent += `${key}="${value}"\n`;
          }
        }

        // Write updated content to .env
        fs.writeFileSync(".env", newEnvContent);
        console.log("✅ Values from .env.local have been written to .env");
      }
    }
  } catch (error) {
    // Error reading .env.local, which is fine
    console.log("Note: No .env.local file found");
  }
}

// TODO: make sure rebuilding is supported

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

async function validateDomain(domain) {
  // Remove http:// or https:// if present
  const cleanDomain = domain.replace(/^https?:\/\//, "");

  // Basic domain validation
  if (
    !cleanDomain.match(
      /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/
    )
  ) {
    throw new Error("Invalid domain format");
  }

  return cleanDomain;
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
          "x-api-key": apiKey,
        },
      }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error querying Neynar app data:", error);
    return null;
  }
}

async function generateFarcasterMetadata(domain, webhookUrl) {
  const tags = process.env.NEXT_PUBLIC_MINI_APP_TAGS?.split(",");

  return {
    accountAssociation: {
      header: "",
      payload: "",
      signature: "",
    },
    frame: {
      version: "1",
      name: process.env.NEXT_PUBLIC_MINI_APP_NAME,
      iconUrl: `https://${domain}/icon.png`,
      homeUrl: `https://${domain}`,
      imageUrl: `https://${domain}/api/opengraph-image`,
      buttonTitle: process.env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT,
      splashImageUrl: `https://${domain}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl,
      description: process.env.NEXT_PUBLIC_MINI_APP_DESCRIPTION,
      primaryCategory: process.env.NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY,
      tags,
    },
  };
}

async function main() {
  try {
    console.log("\n📝 Checking environment variables...");
    console.log("Loading values from .env...");

    // Load .env.local if user wants to
    await loadEnvLocal();

    // Get domain from user
    const { domain } = await inquirer.prompt([
      {
        type: "input",
        name: "domain",
        message:
          "Enter the domain where your mini app will be deployed (e.g., example.com):",
        validate: async (input) => {
          try {
            await validateDomain(input);
            return true;
          } catch (error) {
            return error.message;
          }
        },
      },
    ]);

    // Get frame name from user
    const { frameName } = await inquirer.prompt([
      {
        type: "input",
        name: "frameName",
        message: "Enter the name for your mini app (e.g., My Cool Mini App):",
        default: process.env.NEXT_PUBLIC_MINI_APP_NAME,
        validate: (input) => {
          if (input.trim() === "") {
            return "Mini app name cannot be empty";
          }
          return true;
        },
      },
    ]);

    // Get button text from user
    const { buttonText } = await inquirer.prompt([
      {
        type: "input",
        name: "buttonText",
        message: "Enter the text for your mini app button:",
        default:
          process.env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT || "Launch Mini App",
        validate: (input) => {
          if (input.trim() === "") {
            return "Button text cannot be empty";
          }
          return true;
        },
      },
    ]);

    // Get Neynar configuration
    let neynarApiKey = process.env.NEYNAR_API_KEY;
    let neynarClientId = process.env.NEYNAR_CLIENT_ID;
    let useNeynar = true;

    while (useNeynar) {
      if (!neynarApiKey) {
        const { neynarApiKey: inputNeynarApiKey } = await inquirer.prompt([
          {
            type: "password",
            name: "neynarApiKey",
            message:
              "Enter your Neynar API key (optional - leave blank to skip):",
            default: null,
          },
        ]);
        neynarApiKey = inputNeynarApiKey;
      } else {
        console.log("Using existing Neynar API key from .env");
      }

      if (!neynarApiKey) {
        useNeynar = false;
        break;
      }

      // Try to get client ID from API
      if (!neynarClientId) {
        const appInfo = await queryNeynarApp(neynarApiKey);
        if (appInfo) {
          neynarClientId = appInfo.app_uuid;
          console.log("✅ Fetched Neynar app client ID");
          break;
        }
      }

      // We have a client ID (either from .env or fetched from API), so we can break out of the loop
      if (neynarClientId) {
        break;
      }

      // If we get here, the API key was invalid
      console.log(
        "\n⚠️  Could not find Neynar app information. The API key may be incorrect."
      );
      const { retry } = await inquirer.prompt([
        {
          type: "confirm",
          name: "retry",
          message: "Would you like to try a different API key?",
          default: true,
        },
      ]);

      // Reset for retry
      neynarApiKey = null;
      neynarClientId = null;

      if (!retry) {
        useNeynar = false;
        break;
      }
    }

    // Generate manifest
    console.log("\n🔨 Generating mini app manifest...");

    // Determine webhook URL based on environment variables
    const webhookUrl =
      neynarApiKey && neynarClientId
        ? `https://api.neynar.com/f/app/${neynarClientId}/event`
        : `https://${domain}/api/webhook`;

    const metadata = await generateFarcasterMetadata(domain, webhookUrl);
    console.log("\n✅ Mini app manifest generated");

    // Read existing .env file or create new one
    const envPath = path.join(projectRoot, ".env");
    let envContent = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, "utf8")
      : "";

    // Add or update environment variables
    const newEnvVars = [
      // Base URL
      `NEXT_PUBLIC_URL=https://${domain}`,

      // Mini app metadata
      `NEXT_PUBLIC_MINI_APP_NAME="${frameName}"`,
      `NEXT_PUBLIC_MINI_APP_DESCRIPTION="${
        process.env.NEXT_PUBLIC_MINI_APP_DESCRIPTION || ""
      }"`,
      `NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY="${
        process.env.NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY || ""
      }"`,
      `NEXT_PUBLIC_MINI_APP_TAGS="${
        process.env.NEXT_PUBLIC_MINI_APP_TAGS || ""
      }"`,
      `NEXT_PUBLIC_MINI_APP_BUTTON_TEXT="${buttonText}"`,

      // Analytics
      `NEXT_PUBLIC_ANALYTICS_ENABLED="${
        process.env.NEXT_PUBLIC_ANALYTICS_ENABLED || "false"
      }"`,

      // Neynar configuration (if it exists in current env)
      ...(process.env.NEYNAR_API_KEY
        ? [`NEYNAR_API_KEY="${process.env.NEYNAR_API_KEY}"`]
        : []),
      ...(neynarClientId ? [`NEYNAR_CLIENT_ID="${neynarClientId}"`] : []),

      // FID (if it exists in current env)
      ...(process.env.FID ? [`FID="${process.env.FID}"`] : []),
      `NEXT_PUBLIC_USE_WALLET="${
        process.env.NEXT_PUBLIC_USE_WALLET || "false"
      }"`,

      // NextAuth configuration
      `NEXTAUTH_SECRET="${
        process.env.NEXTAUTH_SECRET || crypto.randomBytes(32).toString("hex")
      }"`,
      `NEXTAUTH_URL="https://${domain}"`,

      // Mini app manifest with signature
      `MINI_APP_METADATA=${JSON.stringify(metadata)}`,
    ];

    // Filter out empty values and join with newlines
    const validEnvVars = newEnvVars.filter((line) => {
      const [, value] = line.split("=");
      return value && value !== '""';
    });

    // Update or append each environment variable
    validEnvVars.forEach((varLine) => {
      const [key] = varLine.split("=");
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(new RegExp(`${key}=.*`), varLine);
      } else {
        envContent += `\n${varLine}`;
      }
    });

    // Write updated .env file
    fs.writeFileSync(envPath, envContent);

    console.log("\n✅ Environment variables updated");

    // Run next build
    console.log("\nBuilding Next.js application...");
    const nextBin = path.normalize(
      path.join(projectRoot, "node_modules", ".bin", "next")
    );
    execSync(`"${nextBin}" build`, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    console.log(
      "\n✨ Build complete! Your mini app is ready for deployment. 🪐"
    );
    console.log(
      "📝 Make sure to configure the environment variables from .env in your hosting provider"
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
