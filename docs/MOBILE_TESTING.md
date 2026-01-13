# FuelRx Mobile App Testing Guide

This guide covers how to test the FuelRx iOS app during development and before App Store submission.

---

## Prerequisites

1. **macOS** with Xcode 15+ installed
2. **Apple Developer Account** (free for simulator testing, $99/year for device testing)
3. **CocoaPods** installed (`sudo gem install cocoapods`)
4. **Node.js 18+** and npm

---

## Quick Start

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Build for mobile and sync with Capacitor
npm run build:mobile

# 3. Open Xcode
npm run cap:open:ios
```

---

## Testing on iOS Simulator

### Step 1: Open Xcode

```bash
npm run cap:open:ios
```

### Step 2: Select a Simulator

In Xcode's toolbar, click the device selector and choose a simulator:
- **iPhone 15 Pro** (recommended for testing)
- **iPhone SE** (test smaller screens)
- **iPad Pro** (test tablet layout)

### Step 3: Build and Run

Press **⌘R** or click the Play button to build and run.

### What to Test on Simulator

| Feature | How to Test | Expected Behavior |
|---------|-------------|-------------------|
| App Launch | Open app | Splash screen, then loads web app |
| Navigation | Tap through all pages | Smooth transitions, no blank screens |
| Scroll | Scroll long lists | Smooth scrolling, no janky behavior |
| Forms | Enter text in forms | Keyboard appears, input works |
| Authentication | Log in/sign up | Auth flow completes successfully |
| Meal Plans | Generate a plan | Shows progress, completes |
| Grocery List | View grocery list | All items display correctly |

### Simulator Limitations

- **Camera**: Not available (use device for Snap-a-Meal testing)
- **Push Notifications**: Not supported
- **Haptics**: Not available
- **Barcode Scanner**: Not available

---

## Testing on Physical Device

### Step 1: Connect Your iPhone

1. Connect iPhone via USB cable
2. Trust the computer on your iPhone when prompted
3. In Xcode, your device should appear in the device selector

### Step 2: Configure Signing

1. In Xcode, select the **App** target in the project navigator
2. Go to **Signing & Capabilities** tab
3. Check **Automatically manage signing**
4. Select your **Team** (your Apple Developer account)

If you see signing errors:
- Ensure you're signed into Xcode with your Apple ID
- The bundle identifier must be unique (change `com.fuelrx.app` if needed)

### Step 3: Build and Run

Press **⌘R** to build and install on your device.

### What to Test on Device

| Feature | How to Test | Expected Behavior |
|---------|-------------|-------------------|
| Camera | Tap Snap-a-Meal | Camera opens, can take photo |
| Photo Library | Choose from gallery | Photo picker opens |
| Haptics | Tap buttons | Feel subtle haptic feedback |
| Push Notifications | Generate meal plan | Receive notification when ready |
| Safe Areas | View on notched device | Content not hidden by notch |
| Barcode Scanner | Scan a product | Scanner opens, reads barcode |
| Offline | Turn on airplane mode | Shows offline fallback |

---

## Testing with Live Reload (Development)

For faster development iteration, you can use live reload:

### Step 1: Find Your Local IP

```bash
ipconfig getifaddr en0
```

### Step 2: Update Capacitor Config

Edit `capacitor.config.ts`:

```typescript
server: {
  url: 'http://YOUR_IP:3000',  // e.g., 'http://192.168.1.100:3000'
  cleartext: true,
}
```

### Step 3: Start Dev Server

```bash
npm run dev
```

### Step 4: Sync and Run

```bash
npx cap sync ios
npx cap run ios
```

Now changes to your code will appear immediately in the app.

> **Important**: Revert the `capacitor.config.ts` changes before building for production!

---

## Pre-Submission Checklist

Before submitting to the App Store, verify:

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

### UI/UX

- [ ] No content hidden by notch/Dynamic Island
- [ ] Bottom nav not hidden by home indicator
- [ ] Text is readable on all screen sizes
- [ ] Buttons are large enough to tap (44x44 minimum)
- [ ] Dark mode looks correct (if supported)
- [ ] Keyboard doesn't cover input fields
- [ ] Loading states are shown during async operations

### Edge Cases

- [ ] Works on slow network (3G simulation)
- [ ] Handles offline gracefully
- [ ] Handles session timeout
- [ ] Error messages are user-friendly
- [ ] Back navigation works as expected

### Performance

- [ ] App launches within 5 seconds
- [ ] Scrolling is smooth (60fps)
- [ ] Memory usage is reasonable
- [ ] No memory leaks during extended use

---

## TestFlight (Beta Testing)

Before public release, test with real users via TestFlight:

### Step 1: Archive the App

1. In Xcode, select **Product > Archive**
2. Wait for archive to complete

### Step 2: Upload to App Store Connect

1. In the Organizer window, select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Follow the prompts to upload

### Step 3: Configure TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app > TestFlight
3. Add internal testers (your team)
4. Add external testers (beta users)
5. Submit for Beta App Review (external testers)

### Step 4: Collect Feedback

- TestFlight provides crash reports automatically
- Users can send feedback via the TestFlight app
- Monitor for issues and iterate

---

## Debugging

### View Logs in Xcode

1. Run the app from Xcode
2. Open **View > Debug Area > Activate Console**
3. JavaScript console.log statements appear here

### Safari Web Inspector

1. On your Mac, open Safari
2. Enable **Develop** menu in Safari preferences
3. Connect your device and run the app
4. In Safari: **Develop > [Your Device] > [App]**
5. Full web inspector for debugging

### Common Issues

| Issue | Solution |
|-------|----------|
| White screen | Check console for JS errors |
| Network errors | Verify Vercel deployment is accessible |
| Camera not working | Test on device, not simulator |
| App crashes on launch | Check Xcode console for crash logs |
| Signing errors | Verify Apple Developer account and team |

---

## Useful Commands

```bash
# Build and sync for mobile
npm run build:mobile

# Sync changes to iOS
npm run cap:sync

# Open Xcode
npm run cap:open:ios

# Run on specific simulator
npx cap run ios --target "iPhone 15 Pro"

# List available simulators
xcrun simctl list devices

# View iOS logs
npx cap run ios -l --external
```

---

## Next Steps

1. Complete testing on simulator and device
2. Fix any issues found
3. Set up TestFlight for beta testing
4. Collect feedback from beta testers
5. Prepare App Store assets (screenshots, descriptions)
6. Submit for App Store review
