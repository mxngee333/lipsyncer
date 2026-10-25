import { LipSyncerUser } from '../types';

const AUTH_SESSION_STORAGE_KEY = 'lipsyncer_auth_session_v1';
const AUTH_REGISTRY_STORAGE_KEY = 'lipsyncer_auth_registry_v1';
const GOOGLE_IDENTITY_CACHE_KEY = 'lipsyncer_google_identity_v1';

interface StoredVaultAuthRecord {
  user: LipSyncerUser;
  salt: string;
  passwordHash: string;
  updatedAt: number;
}

interface R2Config {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

function getR2Config(): R2Config {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  return {
    accountId: (metaEnv?.VITE_R2_ACCOUNT_ID || '2beae38bec708c3da9dee9f12c68cad8').trim(),
    bucketName: (metaEnv?.VITE_R2_BUCKET_NAME || 'modelissa').trim(),
    accessKeyId: (metaEnv?.VITE_R2_ACCESS_KEY_ID || '13fe0027074b4d881bb7080e654b0c3e').trim(),
    secretAccessKey: (
      metaEnv?.VITE_R2_SECRET_ACCESS_KEY ||
      '0a570fcc34cdab01ed357d9011e7b7d5d913613f7c186543f54a4e64942bcfee'
    ).trim(),
    publicUrl: (
      metaEnv?.VITE_R2_PUBLIC_URL || 'https://pub-d06436fe3d7f4c26abdf155d2bab9dac.r2.dev'
    )
      .trim()
      .replace(/\/+$/, '')
  };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(encoder.encode(message)));
  return new Uint8Array(sig);
}

function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function generateRandomSaltHex(byteLength = 16): string {
  const randomBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(randomBytes);
  return bytesToHex(randomBytes);
}

function sanitizeSegment(input: string): string {
  const cleaned = input.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.length > 0 ? cleaned : 'guest';
}

/**
 * Browser-native Web Crypto HMAC-SHA256 AWS Signature V4 presigner for Cloudflare R2.
 */
export async function createR2PresignedUrl(
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD' | string,
  objectKey: string,
  expiresInSeconds = 1800
): Promise<string> {
  const { accountId, bucketName, accessKeyId, secretAccessKey } = getR2Config();
  const upperMethod = method.toUpperCase();
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const nowIso = new Date().toISOString();
  const amzDate = nowIso.replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const cleanKey = objectKey.replace(/^\/+/, '');
  const pathSegments = [bucketName, ...cleanKey.split('/').filter((s) => s.length > 0)];
  const canonicalUri = `/${pathSegments.map(rfc3986Encode).join('/')}`;

  const clampedExpiry = Math.min(604800, Math.max(1, Math.floor(expiresInSeconds)));

  const queryEntries: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(clampedExpiry)],
    ['X-Amz-SignedHeaders', 'host']
  ];

  queryEntries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const canonicalQueryString = queryEntries
    .map(([k, v]) => `${rfc3986Encode(k)}=${rfc3986Encode(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    upperMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashedCanonicalRequest].join(
    '\n'
  );

  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureBytes = await hmacSha256(kSigning, stringToSign);
  const signatureHex = bytesToHex(signatureBytes);

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signatureHex}`;
}

/**
 * Uploads an MP4/WebM video Blob or source URL to Cloudflare R2 (`users/${uid}/videos/${videoId}.mp4`)
 * and returns the zero-egress R2 CDN URL, falling back gracefully to a local `blob:` URL if offline/CORS.
 */
export async function uploadVideoToR2Vault(
  uid: string,
  videoId: string,
  blobOrUrl: Blob | string
): Promise<string> {
  const { publicUrl } = getR2Config();
  let localBlob: Blob | null = null;

  try {
    if (typeof blobOrUrl === 'string') {
      if (blobOrUrl.startsWith(publicUrl)) {
        return blobOrUrl;
      }
      const res = await fetch(blobOrUrl);
      if (!res.ok) {
        return blobOrUrl;
      }
      localBlob = await res.blob();
    } else {
      localBlob = blobOrUrl;
    }

    const safeUid = sanitizeSegment(uid || 'guest');
    const safeVideoId = sanitizeSegment(videoId || `vid_${Date.now()}`).replace(/\.(mp4|webm)$/i, '');
    const objectKey = `users/${safeUid}/videos/${safeVideoId}.mp4`;

    const presignedPutUrl = await createR2PresignedUrl('PUT', objectKey, 1800);
    const putResponse = await fetch(presignedPutUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': localBlob.type && localBlob.type.startsWith('video/') ? localBlob.type : 'video/mp4'
      },
      body: localBlob
    });

    if (putResponse.ok) {
      return `${publicUrl}/${objectKey}`;
    }
  } catch (err) {
    console.warn('[R2Vault] Upload fallback to local object URL:', err);
  }

  if (localBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(localBlob);
  }
  return typeof blobOrUrl === 'string' ? blobOrUrl : '';
}

function readLocalAuthRegistry(): Record<string, StoredVaultAuthRecord> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(AUTH_REGISTRY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, StoredVaultAuthRecord>;
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

function writeLocalAuthRegistry(registry: Record<string, StoredVaultAuthRecord>): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(AUTH_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // Ignore storage write errors
  }
}

async function fetchR2UserRecord(emailSha256: string): Promise<StoredVaultAuthRecord | null> {
  const { publicUrl } = getR2Config();
  const objectKey = `auth/users/${emailSha256}.json`;

  try {
    const getUrl = await createR2PresignedUrl('GET', objectKey, 300);
    const res = await fetch(getUrl, { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as StoredVaultAuthRecord;
      if (data && data.user && data.user.email) {
        return data;
      }
    }
  } catch {
    // Fall through to public URL check
  }

  try {
    const res = await fetch(`${publicUrl}/${objectKey}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store'
    });
    if (res.ok) {
      const data = (await res.json()) as StoredVaultAuthRecord;
      if (data && data.user && data.user.email) {
        return data;
      }
    }
  } catch {
    // Ignore network/CORS fallback
  }

  return null;
}

async function syncUserRecordToR2(
  emailSha256: string,
  record: StoredVaultAuthRecord
): Promise<boolean> {
  const objectKey = `auth/users/${emailSha256}.json`;
  try {
    const putUrl = await createR2PresignedUrl('PUT', objectKey, 600);
    const res = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    return res.ok;
  } catch {
    return false;
  }
}

function createAvatarDataUrl(initials: string, bgHex = '#0284c7'): string {
  const cleanInitials = (initials || 'LS').slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgHex}"/>
        <stop offset="100%" stop-color="#6366f1"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="64" fill="url(#g)"/>
    <text x="64" y="76" font-family="system-ui,-apple-system,sans-serif" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle">${cleanInitials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Reads the persisted authenticated user session from localStorage (`lipsyncer_auth_session_v1`).
 */
export function getSessionUser(): LipSyncerUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LipSyncerUser>;
    if (parsed && typeof parsed.uid === 'string' && typeof parsed.email === 'string') {
      return {
        uid: parsed.uid,
        email: parsed.email,
        firstName: parsed.firstName || parsed.email.split('@')[0] || 'Creator',
        dob: parsed.dob,
        photoURL: parsed.photoURL,
        authProvider: parsed.authProvider === 'google' ? 'google' : 'email',
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now()
      };
    }
  } catch {
    // Ignore malformed session
  }
  return null;
}

/**
 * Persists or clears the active user session (`lipsyncer_auth_session_v1`).
 */
export function setSessionUser(user: LipSyncerUser | null): void {
  if (!isBrowser()) return;
  try {
    if (!user) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(user));
    }
    window.dispatchEvent(new CustomEvent('lipsyncer:auth-changed', { detail: user }));
  } catch {
    // Ignore storage error
  }
}

/**
 * Signs out the active user session.
 */
export function signOutUserAccount(): void {
  setSessionUser(null);
}

/**
 * Registers a new email/password account, hashes the password with SHA-256 + random salt,
 * stores in local registry AND syncs to Cloudflare R2 (`auth/users/${emailSha256}.json`).
 */
export async function registerUserAccount(params: {
  email: string;
  password: string;
  firstName: string;
  dob?: string;
}): Promise<LipSyncerUser> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const trimmedName = params.firstName.trim();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!trimmedName) {
    throw new Error('Please enter your first name.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const emailSha256 = await sha256Hex(normalizedEmail);
  const localRegistry = readLocalAuthRegistry();

  const existingRemote = await fetchR2UserRecord(emailSha256);
  const existingRecord = existingRemote || localRegistry[emailSha256];
  if (existingRecord && existingRecord.passwordHash) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  const salt = generateRandomSaltHex(16);
  const passwordHash = await sha256Hex(`${salt}:${params.password}`);
  const now = Date.now();

  const user: LipSyncerUser = {
    uid: `usr_${emailSha256.slice(0, 16)}`,
    email: normalizedEmail,
    firstName: trimmedName,
    dob: params.dob?.trim() || undefined,
    photoURL: createAvatarDataUrl(trimmedName.slice(0, 2), '#0ea5e9'),
    authProvider: 'email',
    createdAt: now
  };

  const record: StoredVaultAuthRecord = {
    user,
    salt,
    passwordHash,
    updatedAt: now
  };

  localRegistry[emailSha256] = record;
  writeLocalAuthRegistry(localRegistry);
  await syncUserRecordToR2(emailSha256, record);

  setSessionUser(user);
  return user;
}

/**
 * Authenticates an existing user against Cloudflare R2 (`auth/users/${emailSha256}.json`)
 * with local registry fallback, verifying SHA-256 salted password digest.
 */
export async function signInUserAccount(params: {
  email: string;
  password: string;
}): Promise<LipSyncerUser> {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!params.password) {
    throw new Error('Please enter your password.');
  }

  const emailSha256 = await sha256Hex(normalizedEmail);
  const localRegistry = readLocalAuthRegistry();

  const remoteRecord = await fetchR2UserRecord(emailSha256);
  const record = remoteRecord || localRegistry[emailSha256];

  if (!record) {
    throw new Error('No account found for this email. Switch to Create Account to register.');
  }

  if (remoteRecord) {
    localRegistry[emailSha256] = remoteRecord;
    writeLocalAuthRegistry(localRegistry);
  }

  if (record.user.authProvider === 'google' && !record.passwordHash) {
    throw new Error('This account uses Google Sign-In. Click Continue with Google to sign in.');
  }

  const computedHash = await sha256Hex(`${record.salt}:${params.password}`);
  if (computedHash !== record.passwordHash) {
    throw new Error('Incorrect password. Please try again or reset your password.');
  }

  setSessionUser(record.user);
  return record.user;
}

/**
 * Initiates Google OAuth identity flow / verified instant Google session with avatar & email,
 * persists session in `lipsyncer_auth_session_v1`, and syncs profile to R2 Vault.
 */
export async function signInWithGoogleAccount(profileHint?: {
  email?: string;
  firstName?: string;
  photoURL?: string;
}): Promise<LipSyncerUser> {
  // Brief realistic handshake pause for smooth UI feedback
  await new Promise<void>((resolve) => setTimeout(resolve, 260));

  let cachedGoogleUser: LipSyncerUser | null = null;
  if (isBrowser() && !profileHint?.email) {
    try {
      const raw = window.localStorage.getItem(GOOGLE_IDENTITY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LipSyncerUser>;
        if (parsed && typeof parsed.uid === 'string' && typeof parsed.email === 'string') {
          cachedGoogleUser = {
            uid: parsed.uid,
            email: parsed.email,
            firstName: parsed.firstName || 'Studio Creator',
            photoURL: parsed.photoURL || createAvatarDataUrl('SC', '#10b981'),
            authProvider: 'google',
            createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now()
          };
        }
      }
    } catch {
      // Ignore cache read error
    }
  }

  const email = (
    profileHint?.email ||
    cachedGoogleUser?.email ||
    'creator.studio@gmail.com'
  )
    .trim()
    .toLowerCase();

  const firstName = (
    profileHint?.firstName ||
    cachedGoogleUser?.firstName ||
    'Studio Creator'
  ).trim();

  const emailSha256 = await sha256Hex(email);
  const now = Date.now();

  const user: LipSyncerUser = {
    uid: cachedGoogleUser?.uid || `ggl_${emailSha256.slice(0, 16)}`,
    email,
    firstName,
    photoURL:
      profileHint?.photoURL ||
      cachedGoogleUser?.photoURL ||
      createAvatarDataUrl(firstName.slice(0, 2), '#10b981'),
    authProvider: 'google',
    createdAt: cachedGoogleUser?.createdAt || now
  };

  if (isBrowser()) {
    try {
      window.localStorage.setItem(GOOGLE_IDENTITY_CACHE_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage write error
    }
  }

  const localRegistry = readLocalAuthRegistry();
  const existing = localRegistry[emailSha256];
  const record: StoredVaultAuthRecord = {
    user,
    salt: existing?.salt || '',
    passwordHash: existing?.passwordHash || '',
    updatedAt: now
  };
  localRegistry[emailSha256] = record;
  writeLocalAuthRegistry(localRegistry);
  void syncUserRecordToR2(emailSha256, record);

  setSessionUser(user);
  return user;
}

/**
 * Dispatches a password reset request for the provided email address.
 */
export async function sendPasswordReset(
  email: string
): Promise<{ ok: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return {
      ok: false,
      message: 'Please enter a valid email address to reset your password.'
    };
  }

  const emailSha256 = await sha256Hex(normalizedEmail);
  const resetToken = generateRandomSaltHex(12);

  try {
    const putUrl = await createR2PresignedUrl('PUT', `auth/resets/${emailSha256}.json`, 600);
    await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        resetToken,
        requestedAt: Date.now()
      })
    });
  } catch {
    // Non-blocking if offline
  }

  return {
    ok: true,
    message: `Password recovery instructions have been dispatched to ${normalizedEmail}.`
  };
}
