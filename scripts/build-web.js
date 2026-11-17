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
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api-production-167a1dfd.up.railway.app/api',
  EXPO_PUBLIC_API_ORIGIN: process.env.EXPO_PUBLIC_API_ORIGIN || 'https://api-production-167a1dfd.up.railway.app',
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

// 4. Inject mobile responsive viewport & touch resets into dist/index.html
const indexHtmlPath = path.join(rootDist, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  console.log('[build-web] Injecting responsive mobile viewport & iOS/Android resets into index.html...');
  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Replace standard viewport with mobile-first viewport including viewport-fit=cover
  html = html.replace(
    /<meta name="viewport" content="[^"]*"\s*\/?>/i,
    '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />\n    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n    <meta name="theme-color" content="#131016" />'
  );

  // Inject responsive reset styling
  const responsiveStyles = `
    <style id="fnaad-mobile-resets">
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        -webkit-text-size-adjust: 100%;
        touch-action: manipulation;
      }
      body {
        position: fixed;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      #root {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        flex: 1;
      }
      @media screen and (max-width: 767px) {
        input, select, textarea {
          font-size: 16px !important;
        }
      }
    </style>
  `;

  html = html.replace('</head>', `${responsiveStyles}\n  </head>`);
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  // Also keep frontendDist in sync
  fs.writeFileSync(path.join(frontendDist, 'index.html'), html, 'utf8');
}

console.log('[build-web] Build completed successfully! Output ready in /dist.');
