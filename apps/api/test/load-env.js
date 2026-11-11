// Fills in from apps/api/.env whatever the environment doesn't already set —
// CI passes real variables; a laptop has the .env.
const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", ".env");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (match && match[1] && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

for (const name of ["DATABASE_URL", "APP_DATABASE_URL"]) {
  if (!process.env[name]) {
    throw new Error(`${name} is required for integration tests (see jest.integration.config.js)`);
  }
}
