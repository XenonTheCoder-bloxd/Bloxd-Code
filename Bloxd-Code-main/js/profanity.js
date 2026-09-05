

const BANNED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nigga", "faggot", "dick",
  "pussy", "whore", "slut", "cock", "bastard", "nazi", "hitler", "kill", "suicide",
  "porn", "hentai", "sex", "dildo", "pedophile", "rape", "retard", "fag"
];

const RESERVED_USERNAMES = [
  "admin", "administrator", "root", "system", "bloxd", "bloxdcode", "api", "auth",
  "support", "official", "mod", "moderator", "staff", "dev", "developer", "help",
  "security", "null", "undefined", "server", "bot"
];

 
function normalizeLeetSpeak(text) {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[\-_.*+~#^]/g, "");
}

 
export function containsProfanity(text) {
  if (!text) return false;
  const normalized = normalizeLeetSpeak(text);
  
  for (const word of BANNED_WORDS) {
    if (normalized.includes(word)) {
      return true;
    }
  }
  return false;
}

 
export function validateUsername(username) {
  if (!username) {
    return { valid: false, error: "Username cannot be empty." };
  }
  
  const trimmed = username.trim().toLowerCase();
  
  if (trimmed.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters." };
  }
  
  if (trimmed.length > 20) {
    return { valid: false, error: "Username cannot exceed 20 characters." };
  }
  
  
  const validPattern = /^[a-z0-9_\-]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: "Username can only contain letters, numbers, hyphens, and underscores." };
  }
  
  if (trimmed.startsWith("-") || trimmed.endsWith("-") || trimmed.startsWith("_") || trimmed.endsWith("_")) {
    return { valid: false, error: "Username cannot start or end with a hyphen or underscore." };
  }
  
  if (RESERVED_USERNAMES.includes(trimmed)) {
    return { valid: false, error: "This username is reserved by Bloxd Code." };
  }
  
  if (containsProfanity(trimmed)) {
    return { valid: false, error: "Username contains inappropriate language or restricted terms." };
  }
  
  return { valid: true, username: trimmed };
}

 
export function sanitizeText(text) {
  if (!text) return "";
  let clean = text;
  for (const word of BANNED_WORDS) {
    const reg = new RegExp(word, "gi");
    clean = clean.replace(reg, "*".repeat(word.length));
  }
  return clean;
}
