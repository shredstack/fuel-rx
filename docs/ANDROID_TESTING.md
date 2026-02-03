# FuelRx Android Testing Guide

This guide covers how to test the FuelRx Android app during development and before Google Play Store submission.

---

## Prerequisites

1. **Android Studio** (latest stable) installed
2. **Google Play Developer Account** ($25 one-time fee)
3. **Node.js 22+** and npm
4. **Java 17+** (bundled with Android Studio)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build for mobile and sync with Capacitor
npm run build:mobile android

# 3. Open Android Studio
npm run cap:open:android
```

---

## Testing on Android Emulator

### Step 1: Create an Emulator

1. In Android Studio: Tools > Device Manager
2. Click "Create Device"
3. Select a phone profile:
   - **Pixel 7** (recommended for testing)
   - **Pixel 4a** (test smaller screens)
4. Select a system image (API 34 / Android 14 recommended)
5. Finish setup

### Step 2: Run the App

1. Select your emulator from the device dropdown
2. Click the Run button or press Shift+F10
3. Wait for Gradle build and app installation

### What to Test on Emulator

| Feature | How to Test | Expected Behavior |
|---------|-------------|-------------------|
| App Launch | Open app | Splash screen then loads web app |
| Navigation | Tap through all pages | Smooth transitions |
| Scroll | Scroll long lists | Smooth scrolling |
| Forms | Enter text in forms | Keyboard appears, input works |
| Authentication | Log in/sign up | Auth flow completes |
| Meal Plans | Generate a plan | Shows progress, completes |
| Grocery List | View grocery list | All items display correctly |
| Back Button | Press Android back | Navigates back correctly |

### Emulator Limitations

- **Camera**: Limited (use physical device for Snap-a-Meal)
- **Push Notifications**: Supported (with Firebase)
- **Haptics**: Not available
- **Barcode Scanner**: Limited

---

## Testing on Physical Device

### Step 1: Enable Developer Mode

1. Settings > About Phone > Tap "Build Number" 7 times
2. Settings > Developer Options > Enable USB Debugging

### Step 2: Connect Device

1. Connect via USB cable
2. Allow USB debugging when prompted on device
3. Device appears in Android Studio device selector

### Step 3: Run

Click Run — app installs and launches on your device.

### Device-Specific Tests

| Feature | How to Test | Expected Behavior |
|---------|-------------|-------------------|
| Camera | Tap Snap-a-Meal | Camera opens |
| Haptics | Tap buttons | Feel haptic feedback |
| Push Notifications | Generate meal plan | Receive notification |
| Barcode Scanner | Scan a product | Scanner reads barcode |
| Back Button | System back gesture | Correct back navigation |
| Gesture Navigation | Swipe gestures | No conflicts with app UI |

---

## Testing with Live Reload

```bash
# 1. Get your local IP
hostname -I | awk '{print $1}'  # Linux
ipconfig getifaddr en0           # macOS

# 2. Sync with local server URL
CAPACITOR_SERVER_URL=http://YOUR_IP:3000 npx cap sync android

# 3. Start dev server
npm run dev

# 4. Run in Android Studio
# Changes appear immediately in the app
```

> **Important**: Revert to production URL before building for release!

---

## Building a Release APK/AAB

### For Testing (APK)

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### For Play Store (AAB)

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Debugging

### Chrome DevTools

1. Run the app on device/emulator
2. Open Chrome on your computer
3. Navigate to `chrome://inspect`
4. Your app's WebView should appear — click "inspect"
5. Full DevTools for debugging

### Logcat

1. In Android Studio: View > Tool Windows > Logcat
2. Filter by your app package: `com.fuelrx.app`
3. JavaScript console.log statements appear with `Capacitor` tag

### Common Issues

| Issue | Solution |
|-------|----------|
| White screen | Check Logcat for JS errors |
| Network errors | Verify Vercel deployment is accessible |
| Build fails | Run Build > Clean Project, then rebuild |
| Gradle sync error | File > Invalidate Caches / Restart |
| Camera not working | Test on physical device |
| Back button exits app | Check WebView navigation stack |

---

## Pre-Submission Checklist

### Functionality
- [ ] App launches without crashing
- [ ] Login/signup works
- [ ] Onboarding flow completes
- [ ] Meal plan generation works end-to-end
- [ ] Grocery list displays correctly
- [ ] Prep mode functions properly
- [ ] Snap-a-Meal captures and analyzes photos
- [ ] Settings save and persist
- [ ] Logout works
- [ ] Android back button/gesture works correctly
- [ ] Subscriptions purchase flow works (sandbox)

### UI/UX
- [ ] No content hidden by status bar or navigation bar
- [ ] Bottom nav not hidden by gesture bar
- [ ] Text readable on all screen sizes
- [ ] Buttons large enough to tap (48dp minimum on Android)
- [ ] Keyboard doesn't cover input fields
- [ ] Loading states shown during async operations
- [ ] Edge-to-edge display looks correct

### Android-Specific
- [ ] Back gesture navigation works properly
- [ ] App handles configuration changes (rotation)
- [ ] Deep links work (if applicable)
- [ ] Push notifications arrive and open correct screen
- [ ] App works on Android 7+ (API 24+)
- [ ] App works on various screen densities

### Performance
- [ ] App launches within 5 seconds
- [ ] Scrolling is smooth
- [ ] Memory usage is reasonable
- [ ] No ANR (Application Not Responding) dialogs
