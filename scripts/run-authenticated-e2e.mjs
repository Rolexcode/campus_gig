import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { delimiter, join } from "node:path";

function findLocalJavaHome() {
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) return "";

  const installsRoot = join(
    process.env.LOCALAPPDATA,
    "campusgig-tools",
    "temurin21-jre",
  );
  if (!existsSync(installsRoot)) return "";

  return (
    readdirSync(installsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(installsRoot, entry.name))
      .find((candidate) =>
        existsSync(join(candidate, "bin", "java.exe")),
      ) ?? ""
  );
}

const javaHome = process.env.JAVA_HOME?.trim() || findLocalJavaHome();

const env = {
  ...process.env,
  E2E_USE_FIREBASE_EMULATORS: "true",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-fake-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "campusgig-e2e.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "campusgig-e2e",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "campusgig-e2e.appspot.com",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:e2e",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  GCLOUD_PROJECT: "campusgig-e2e",
  ADMIN_EMAILS: "admin.e2e@example.com",
  WALLET_ENCRYPTION_KEY:
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  ...(javaHome
    ? {
        JAVA_HOME: javaHome,
        PATH: `${join(javaHome, "bin")}${delimiter}${process.env.PATH ?? ""}`,
      }
    : {}),
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [
  join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
  "build",
]);
run(process.execPath, [
  join(process.cwd(), "node_modules", "@playwright", "test", "cli.js"),
  "test",
  "e2e/authenticated-marketplace.spec.ts",
  "--project=desktop-chromium",
]);
