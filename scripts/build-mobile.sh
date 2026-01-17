#!/bin/bash

# Build script for Capacitor mobile app
# This approach uses a remote server (Vercel) rather than static export
# The iOS app is a native wrapper that loads your web app from Vercel

set -e

echo "Building FuelRx mobile app..."

# Create a minimal out directory for Capacitor to use as fallback
mkdir -p out

# Create a minimal index.html that redirects to the Vercel deployment
# This is used if the remote server is unreachable
cat > out/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>FuelRx</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #18181b;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .container {
      text-align: center;
    }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #a1a1aa; margin-bottom: 24px; }
    button {
      background: #14b8a6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FuelRx</h1>
    <p>Loading your meal plans...</p>
    <button onclick="location.reload()">Retry</button>
  </div>
  <script>
    // Redirect to main app if online
    if (navigator.onLine) {
      window.location.href = 'https://fuel-rx.shredstack.net';
    }
  </script>
</body>
</html>
EOF

echo "Created fallback HTML..."

# Sync with Capacitor
echo "Syncing with Capacitor..."
npx cap sync

echo "Mobile build complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'npx cap open ios' to open Xcode"
echo "  2. Select your development team in Signing & Capabilities"
echo "  3. Build and run on simulator or device"
