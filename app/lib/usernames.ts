const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "campusgig",
  "help",
  "payments",
  "security",
  "support",
  "system",
]);

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

export function usernameValidationMessage(value: unknown) {
  const username = normalizeUsername(value);
  if (!username) return "Choose a username.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Use 3–30 characters, start with a letter, and include only letters, numbers, or underscores.";
  }
  if (RESERVED_USERNAMES.has(username)) return "That username is reserved. Choose another one.";
  return "";
}

export function validatedUsername(value: unknown) {
  const username = normalizeUsername(value);
  const message = usernameValidationMessage(username);
  if (message) throw new Error(message);
  return username;
}

export function usernameSearchPrefix(value: unknown) {
  const prefix = normalizeUsername(value);
  if (!prefix) return "";
  if (!/^[a-z0-9_]{1,30}$/.test(prefix)) {
    throw new Error("Search with letters, numbers, or underscores only.");
  }
  return prefix;
}
