# Capacitor Setup & App Store Deployment Guide

## 1. Install Capacitor Dependencies
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
```

## 2. Initialize Capacitor (if not done)
```bash
npx cap init "Violets and Vibes" "com.violetsandvibes.app"
```

## 3. Build and Sync
```bash
npm run build:mobile
```

If the native projects do not exist yet, run:

```bash
npx cap add ios
npx cap add android
```

## 4. iOS App Store Steps
1. **Xcode Setup:**
   ```bash
   npm run ios
   ```
2. **In Xcode:**
   - Set Team & Bundle ID
   - Configure signing certificates
   - Set deployment target (iOS 13+)
   - Add privacy descriptions in Info.plist

3. **App Store Connect:**
   - Create app listing
   - Upload build via Xcode
   - Fill app metadata
   - Submit for review

## 5. Google Play Store Steps
1. **Android Studio:**
   ```bash
   npm run android
   ```
2. **Build Release:**
   - Generate signed APK/AAB
   - Configure app signing
   - Set version codes

3. **Play Console:**
   - Create app listing
   - Upload AAB file
   - Complete store listing
   - Submit for review

## 6. Required Assets Created
✅ App icons (192x192, 512x512)
✅ Capacitor config
✅ Build scripts
✅ Manifest.json

## Next Steps
1. Run `npm install` to install Capacitor
2. Run `npm run build:mobile` to build for mobile
3. Test on device/simulator
4. Submit to stores
