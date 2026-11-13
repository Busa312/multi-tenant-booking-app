// R430: makes the ADMIN_PASSWORD_HASH for the platform admin page.
//   pnpm --filter @booking/api admin:hash
// The password is typed without being shown, and never written anywhere.
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";

const MIN_LENGTH = 12;

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Don't echo what is typed.
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) process.stdout.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await ask("Admin password: ");
if (password.length < MIN_LENGTH) {
  console.error(`Use at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}
if ((await ask("Again: ")) !== password) {
  console.error("The two don't match.");
  process.exit(1);
}
console.log("\nADMIN_PASSWORD_HASH=" + bcrypt.hashSync(password, 12));
console.log("\nPut it in the API's environment as is (in a .env file, wrap it in single quotes: it contains $).");
