const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'fnaad-frontend');
const rootDist = path.join(rootDir, 'dist');
const frontendDist = path.join(frontendDir, 'dist');

console.log('[build-web] Starting build for Cloudflare...');

// Default production env vars for Expo web if not set in CI/environment
const buildEnv = {
  ...process.env,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://fnaad-api.onrender.com/api',
  EXPO_PUBLIC_API_ORIGIN: process.env.EXPO_PUBLIC_API_ORIGIN || 'https://fnaad-api.onrender.com',
  EXPO_PUBLIC_FNAAD_SUBSCRIPTION_MOMO_PROVIDER: process.env.EXPO_PUBLIC_FNAAD_SUBSCRIPTION_MOMO_PROVIDER || 'Orange Money',
  EXPO_PUBLIC_FNAAD_SUBSCRIPTION_WHATSAPP: process.env.EXPO_PUBLIC_FNAAD_SUBSCRIPTION_WHATSAPP || '237688254466',
};

// 1. Install dependencies in fnaad-frontend if node_modules is missing
if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
  console.log('[build-web] Installing dependencies in fnaad-frontend...');
  execSync('npm install', { cwd: frontendDir, stdio: 'inherit', env: buildEnv });
}

// 2. Run expo web export
console.log('[build-web] Building frontend (expo export -p web)...');
execSync('npm run build', { cwd: frontendDir, stdio: 'inherit', env: buildEnv });

// 3. Ensure root dist exists and copy files over
console.log('[build-web] Copying build output to root /dist directory...');
if (fs.existsSync(rootDist)) {
  fs.rmSync(rootDist, { recursive: true, force: true });
}

fs.cpSync(frontendDist, rootDist, { recursive: true });

console.log('[build-web] Build completed successfully! Output ready in /dist.');
