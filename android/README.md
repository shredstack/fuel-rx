# FuelRx Android App

This is the Capacitor-based Android wrapper for FuelRx. The native app is a WebView that loads the web app from `https://fuel-rx.shredstack.net`, so web changes appear automatically without rebuilding or resubmitting the app.

## Quick Start

### Build and Sync

```bash
# Sync web assets to Android
npm run cap:sync:android

# Or use the build script (creates fallback HTML + syncs)
npm run build:mobile android
```

### Open in Android Studio

```bash
npm run cap:open:android
```

Then use the Run button in Android Studio to deploy to an emulator or connected device.

### Run Directly from CLI

```bash
npm run cap:run:android
```

### Live Reload (Development)

```bash
npx cap run android --livereload --external
```

## All Available Scripts

| Script | Command |
|--------|---------|
| Sync Android | `npm run cap:sync:android` |
| Open Android Studio | `npm run cap:open:android` |
| Run on Device/Emulator | `npm run cap:run:android` |
| Build Mobile (all platforms) | `npm run build:mobile` |
| Build Mobile (Android only) | `npm run build:mobile android` |

## Creating a Release for Google Play Console

### 1. Sync the Latest Changes

```bash
npm run build:mobile android
```

### 2. Open the Project in Android Studio

```bash
npm run cap:open:android
```

### 3. Update Version Numbers

In Android Studio, open `app/build.gradle` and increment:
- `versionCode` - Integer that must increase with each release (e.g., 1 → 2 → 3)
- `versionName` - User-facing version string (e.g., "1.0.0" → "1.0.1")

### 4. Build a Signed App Bundle (AAB)

1. In Android Studio: **Build → Generate Signed Bundle / APK...**
2. Select **Android App Bundle** and click Next
3. Choose your keystore file (or create one if first release)
   - Store the keystore securely - you need the same one for all future updates
4. Enter keystore password, key alias, and key password
5. Select **release** build variant
6. Click **Create**

The signed AAB will be generated at:
```
android/app/release/app-release.aab
```

### 5. Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select the FuelRx app
3. Navigate to **Release → Production** (or Testing track)
4. Click **Create new release**
5. Upload the `.aab` file
6. Add release notes describing what changed
7. Review and roll out

### Tips

- **Testing first**: Use Internal Testing or Closed Testing tracks before Production
- **Staged rollout**: Start with a small percentage of users to catch issues early
- **Keep your keystore safe**: If you lose it, you cannot update the app

## How It Works

The app uses a remote server approach:
1. The native Android app is a wrapper that loads from Vercel
2. A fallback HTML page is included in case the server is unreachable
3. Web changes deploy to Vercel and appear in the app automatically

## Requirements

- Android Studio
- Android SDK configured
- Node.js and npm
