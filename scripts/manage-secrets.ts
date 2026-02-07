import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  intro,
  outro,
  select,
  multiselect,
  spinner,
  cancel,
  isCancel,
} from "@clack/prompts";

interface Secret {
  name: string;
  value: string;
}

function executeCommand(command: string): string {
  try {
    return execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();
  } catch (error: any) {
    throw new Error(error.stderr || error.message);
  }
}

function validateSecretName(name: string): boolean {
  // Secret names must be valid identifiers (alphanumeric + underscore)
  // This prevents command injection
  const validPattern = /^[A-Z][A-Z0-9_]*$/;
  return validPattern.test(name);
}

function readDevVars(): Secret[] {
  const devVarsPath = path.join(__dirname, "..", ".dev.vars");

  if (!fs.existsSync(devVarsPath)) {
    console.error(
      "\x1b[31m✗ .dev.vars file not found. Run 'bun run setup' first.\x1b[0m"
    );
    process.exit(1);
  }

  const content = fs.readFileSync(devVarsPath, "utf-8");
  const secrets: Secret[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [name, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim();

    // Only include actual secrets (not NEXT_PUBLIC_ vars)
    if (name && value && !name.startsWith("NEXT_PUBLIC_")) {
      const secretName = name.trim();

      // Validate secret name to prevent command injection
      if (!validateSecretName(secretName)) {
        console.warn(
          `\x1b[33m⚠ Skipping invalid secret name: ${secretName} (must be uppercase alphanumeric + underscore)\x1b[0m`
        );
        continue;
      }

      secrets.push({ name: secretName, value });
    }
  }

  return secrets;
}

async function uploadSecret(secretName: string, secretValue: string) {
  if (!validateSecretName(secretName)) {
    console.log(
      `\x1b[31m✗ Invalid secret name: ${secretName} (must be uppercase alphanumeric + underscore)\x1b[0m`
    );
    return false;
  }

  if (!secretValue || secretValue === "") {
    console.log(`\x1b[33m⚠ Skipping ${secretName} (empty value)\x1b[0m`);
    return false;
  }

  const secretSpinner = spinner();
  secretSpinner.start(`Uploading ${secretName}...`);

  try {
    const tempFile = path.join(__dirname, "..", `.temp-${secretName}`);
    fs.writeFileSync(tempFile, secretValue);

    try {
      const command =
        process.platform === "win32"
          ? `type "${tempFile}" | wrangler secret put ${secretName}`
          : `cat "${tempFile}" | wrangler secret put ${secretName}`;

      executeCommand(command);
      secretSpinner.stop(`\x1b[32m✓ ${secretName} uploaded\x1b[0m`);
      return true;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  } catch (error: any) {
    secretSpinner.stop(
      `\x1b[31m✗ Failed to upload ${secretName}: ${error.message}\x1b[0m`
    );
    return false;
  }
}

async function listRemoteSecrets(): Promise<string[]> {
  try {
    const output = executeCommand("wrangler secret list --format json");
    const secrets = JSON.parse(output) as Array<{ name?: unknown }>;

    return secrets
      .map((secret) => secret.name)
      .filter((name): name is string => typeof name === "string");
  } catch (error: any) {
    console.error(`\x1b[31m✗ Failed to list secrets: ${error.message}\x1b[0m`);
    return [];
  }
}

async function deleteSecret(secretName: string) {
  if (!validateSecretName(secretName)) {
    console.log(
      `\x1b[31m✗ Invalid secret name: ${secretName} (must be uppercase alphanumeric + underscore)\x1b[0m`
    );
    return false;
  }

  const secretSpinner = spinner();
  secretSpinner.start(`Deleting ${secretName}...`);

  try {
    executeCommand(`wrangler secret delete ${secretName}`);
    secretSpinner.stop(`\x1b[32m✓ ${secretName} deleted\x1b[0m`);
    return true;
  } catch (error: any) {
    secretSpinner.stop(
      `\x1b[31m✗ Failed to delete ${secretName}: ${error.message}\x1b[0m`
    );
    return false;
  }
}

async function main() {
  intro("🔐 Secrets Management Tool");

  // Check if wrangler.json exists
  const wranglerConfigPath = path.join(__dirname, "..", "wrangler.json");
  if (!fs.existsSync(wranglerConfigPath)) {
    console.error(
      "\x1b[31m✗ wrangler.json not found. Run 'bun run setup' first.\x1b[0m"
    );
    process.exit(1);
  }

  // Check if wrangler is authenticated
  try {
    const whoami = executeCommand("wrangler whoami");
    if (whoami.includes("not authenticated")) {
      throw new Error("Not authenticated");
    }
  } catch (error) {
    console.error(
      "\x1b[31m✗ Not logged in. Please run 'wrangler login' first.\x1b[0m"
    );
    process.exit(1);
  }

  const action = await select({
    message: "What would you like to do?",
    options: [
      { value: "upload-all", label: "Upload all secrets from .dev.vars" },
      { value: "upload-select", label: "Upload selected secrets" },
      { value: "list", label: "List remote secrets" },
      { value: "delete", label: "Delete secrets" },
    ],
  });

  if (isCancel(action)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  switch (action) {
    case "upload-all": {
      const secrets = readDevVars();

      if (secrets.length === 0) {
        console.log(
          "\x1b[33mNo secrets found in .dev.vars (all variables may be NEXT_PUBLIC_ or empty)\x1b[0m"
        );
        break;
      }

      console.log(`\n\x1b[36mUploading ${secrets.length} secrets...\x1b[0m\n`);

      let succeeded = 0;
      let failed = 0;

      for (const secret of secrets) {
        const result = await uploadSecret(secret.name, secret.value);
        if (result) succeeded++;
        else failed++;
      }

      console.log(`\n\x1b[32m✓ Uploaded ${succeeded} secret(s)\x1b[0m`);
      if (failed > 0) {
        console.log(`\x1b[31m✗ Failed ${failed} secret(s)\x1b[0m`);
      }
      break;
    }

    case "upload-select": {
      const secrets = readDevVars();

      if (secrets.length === 0) {
        console.log(
          "\x1b[33mNo secrets found in .dev.vars (all variables may be NEXT_PUBLIC_ or empty)\x1b[0m"
        );
        break;
      }

      const selected = await multiselect({
        message: "Select secrets to upload:",
        options: secrets.map((s) => ({
          value: s.name,
          label: s.name,
        })),
      });

      if (isCancel(selected)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      console.log(
        `\n\x1b[36mUploading ${selected.length} secret(s)...\x1b[0m\n`
      );

      let succeeded = 0;
      let failed = 0;

      for (const secretName of selected as string[]) {
        const secret = secrets.find((s) => s.name === secretName);
        if (secret) {
          const result = await uploadSecret(secret.name, secret.value);
          if (result) succeeded++;
          else failed++;
        }
      }

      console.log(`\n\x1b[32m✓ Uploaded ${succeeded} secret(s)\x1b[0m`);
      if (failed > 0) {
        console.log(`\x1b[31m✗ Failed ${failed} secret(s)\x1b[0m`);
      }
      break;
    }

    case "list": {
      console.log("\n\x1b[36mFetching remote secrets...\x1b[0m\n");
      const remoteSecrets = await listRemoteSecrets();

      if (remoteSecrets.length === 0) {
        console.log("\x1b[33mNo secrets found in Cloudflare Workers.\x1b[0m");
      } else {
        console.log("\x1b[32mRemote secrets:\x1b[0m");
        remoteSecrets.forEach((secret) => {
          console.log(`  • ${secret}`);
        });
      }
      break;
    }

    case "delete": {
      console.log("\n\x1b[36mFetching remote secrets...\x1b[0m\n");
      const remoteSecrets = await listRemoteSecrets();

      if (remoteSecrets.length === 0) {
        console.log("\x1b[33mNo secrets found to delete.\x1b[0m");
        break;
      }

      const toDelete = await multiselect({
        message: "Select secrets to delete:",
        options: remoteSecrets.map((s) => ({
          value: s,
          label: s,
        })),
      });

      if (isCancel(toDelete)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      console.log(
        `\n\x1b[36mDeleting ${toDelete.length} secret(s)...\x1b[0m\n`
      );

      let succeeded = 0;
      let failed = 0;

      for (const secretName of toDelete as string[]) {
        const result = await deleteSecret(secretName);
        if (result) succeeded++;
        else failed++;
      }

      console.log(`\n\x1b[32m✓ Deleted ${succeeded} secret(s)\x1b[0m`);
      if (failed > 0) {
        console.log(`\x1b[31m✗ Failed ${failed} secret(s)\x1b[0m`);
      }
      break;
    }
  }

  outro("✨ Done!");
}

main().catch((error) => {
  console.error("\x1b[31m✗ Error:", error.message, "\x1b[0m");
  process.exit(1);
});
