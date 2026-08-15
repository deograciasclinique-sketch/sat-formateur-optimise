/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility functions for password-based encryption and decryption using standard AES-GCM (256-bit) and PBKDF2.
 * Suitable for encrypting patient clinical data before local download or cloud backup.
 */

// Helper to convert an ArrayBuffer to a base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert a base64 string to an ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a plaintext string using a password.
 * Returns a Base64 encoded string containing: Salt (16 bytes) + IV (12 bytes) + Ciphertext.
 */
export async function encryptData(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const rawData = encoder.encode(plaintext);

  // 1. Generate salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Import password as raw key material
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // 3. Derive 256-bit AES-GCM key using PBKDF2
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // 4. Encrypt data
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    aesKey,
    rawData
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 5. Pack everything: Salt (16 bytes) + IV (12 bytes) + Ciphertext
  const totalLength = salt.length + iv.length + ciphertext.length;
  const packed = new Uint8Array(totalLength);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(ciphertext, salt.length + iv.length);

  // 6. Encode to base64
  return arrayBufferToBase64(packed.buffer);
}

/**
 * Decrypts a Base64 encoded string using a password.
 * The string must have been encrypted by the `encryptData` function.
 */
export async function decryptData(encryptedBase64: string, password: string): Promise<string> {
  const decoder = new TextDecoder();
  const packedBuffer = base64ToArrayBuffer(encryptedBase64);
  const packed = new Uint8Array(packedBuffer);

  if (packed.length < 28) {
    throw new Error("Données de sauvegarde corrompues ou trop courtes (le format est incorrect).");
  }

  // 1. Unpack Salt (16 bytes), IV (12 bytes), and Ciphertext
  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const ciphertext = packed.slice(28);

  // 2. Import password
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // 3. Derive AES-GCM key
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // 4. Decrypt
  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      aesKey,
      ciphertext.buffer
    );

    return decoder.decode(decryptedBuffer);
  } catch (err) {
    throw new Error("Mot de passe incorrect ou données corrompues. Échec du déchiffrement.");
  }
}
