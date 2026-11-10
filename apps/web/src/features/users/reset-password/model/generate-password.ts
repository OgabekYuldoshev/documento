const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 14 random characters without look-alikes (0/O, 1/l/I); always contains a letter and a digit. */
export function generatePassword(length = 14): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint32Array(length));
    const value = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
    if (/[a-zA-Z]/.test(value) && /\d/.test(value)) return value;
  }
}
