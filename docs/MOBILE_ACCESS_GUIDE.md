# CAREi Family Mobile Access Guide

## Overview

CAREi provides **three ways** for families to access care information on mobile devices:

1. **Progressive Web App (PWA)** - Recommended for most families
2. **Native Android App** - Best performance and features
3. **Mobile Web Browser** - Quick access without installation

---

## 1. Progressive Web App (PWA) 📱

### What is a PWA?
A PWA works like a native app but runs in the browser. It can:
- Be installed on the home screen
- Work offline
- Send push notifications
- Access device features

### How Families Install:

#### **iPhone / iPad (Safari)**
1. Open Safari and go to: `https://carei-app.vercel.app/family/login`
2. Tap the **Share button** (🔗) at the bottom
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right
5. The CAREi icon appears on the home screen!

#### **Android (Chrome)**
1. Open Chrome and go to: `https://carei-app.vercel.app/family/login`
2. Tap the **Menu button** (⋮) in the top right
3. Tap **"Add to Home Screen"** or **"Install App"**
4. Tap **"Install"**
5. The CAREi icon appears on the home screen!

#### **Android (Samsung Internet)**
1. Open Samsung Internet browser
2. Go to: `https://carei-app.vercel.app/family/login`
3. Tap the **Menu button** (⋮)
4. Tap **"Add page to"** → **"Home screen"**

### PWA Features:
✅ **Instant Access** - Tap icon, no browser chrome
✅ **Offline Mode** - View cached data without internet
✅ **Push Notifications** - Get alerts for visits, messages, tasks
✅ **Secure** - Encrypted and authenticated
✅ **Auto-Update** - Always latest version
✅ **Small Size** - No app store download needed

---

## 2. Native Android App 🤖

### For Families Who Want Native Features:

#### **Features Available in Native App:**
- **Biometric Login** - Fingerprint or Face ID
- **Better Performance** - Faster than browser
- **Background Sync** - Update data even when app is closed
- **Native Notifications** - More reliable than web push
- **Device Integration** - Share photos, use contacts

#### **How to Install:**

**Option A: Download APK (Direct)**
1. Manager sends APK file to family
2. Family enables "Unknown Sources" in Settings
3. Install the APK
4. Open and log in

**Option B: Build from Source (For Agencies)**
```bash
# Build the web app
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Or build directly
cd android
./gradlew assembleRelease
```

**Option C: Google Play Store (Future)**
- Submit app to Play Store
- Families download normally
- Auto-updates managed by Google

---

## 3. Mobile Web Browser 🌐

### Quick Access Without Installation:

Simply open any mobile browser and go to:
```
https://carei-app.vercel.app/family/login
```

**Pros:**
- No installation required
- Works on any device
- Instant access

**Cons:**
- No push notifications
- No offline access
- Browser UI takes up screen space

---

## Mobile Feature Comparison

| Feature | PWA | Native App | Browser |
|---------|-----|------------|---------|
| **Install Required** | Optional | Yes | No |
| **Home Screen Icon** | ✅ | ✅ | ❌ |
| **Push Notifications** | ✅ | ✅ | ❌ |
| **Offline Access** | ✅ | ✅ | ❌ |
| **Biometric Login** | ❌ | ✅ | ❌ |
| **Auto-Update** | ✅ | ✅* | ✅ |
| **App Store** | ❌ | Required | ❌ |
| **Performance** | Good | Best | Good |
| **Storage** | Small | Larger | None |
| **Setup Time** | 30 seconds | 2-5 minutes | 0 seconds |

*For Play Store distribution

---

## Family Mobile Features 🚀

### Real-Time Notifications:
- 📢 **Visit Started** - "Carer has arrived for Mum's visit"
- ✅ **Visit Completed** - "Mum's visit is complete. View summary →"
- 💬 **New Message** - "Nurse Sarah sent a message"
- 📋 **Task Reminder** - "Give Dad his medication at 2pm"
- 🚨 **Emergency Alert** - Immediate alerts for urgent situations

### Quick Actions:
- **One-tap login** with PIN (no password typing)
- **Swipe gestures** for task completion
- **Pull-to-refresh** for updates
- **Long press** for quick options

### Offline Capabilities:
- View client information without internet
- See cached visit history
- Read previous messages
- Complete tasks (syncs when online)

### Accessibility:
- **Large text mode** - Bigger fonts for elderly family members
- **High contrast** - Better visibility
- **VoiceOver/TalkBack** - Screen reader support
- **Haptic feedback** - Vibration on actions

---

## Setting Up Family Mobile Access 🔧

### Step 1: Invite Family Members
Managers can invite families through:
1. Manager Dashboard → Client Profile
2. Click "Invite Family Member"
3. Enter family email and relationship
4. Send invitation

### Step 2: Family Receives Invitation
Family gets an email with:
- Login link: `https://carei-app.vercel.app/family/login`
- Temporary PIN: `123456`
- Setup instructions

### Step 3: Family Logs In
1. Open the link on mobile
2. Enter email and PIN
3. Optionally install PWA when prompted
4. Enable notifications if desired

### Step 4: Customize Settings
- Update PIN to personal 6-digit code
- Add phone number for SMS alerts
- Choose notification preferences
- Set up biometric login (native app only)

---

## Troubleshooting 🔧

### Can't Install PWA?
**iPhone:** Must use Safari (Chrome/Firefox don't support iOS PWA install)
**Android:** Use Chrome for best experience

### Notifications Not Working?
1. Check browser permission (Settings → Notifications)
2. Ensure PWA is installed (not just bookmarked)
3. Re-enable notifications in Family Settings

### App Looks Like Website?
- Must use "Add to Home Screen" (not bookmark)
- Check that `display: standalone` is active
- Close browser and open from home screen icon

### Offline Mode Not Working?
- Must visit pages while online first (caching)
- Ensure PWA is installed (not browser mode)
- Check storage permission

### Biometric Login Missing?
- Only available in native Android app
- Device must have fingerprint/face scanner
- Enable in Family Settings → Security

---

## Quick Reference Card 📋

### For Managers (To Share with Families):

```
🌟 CAREi Family Access

1. Open your phone browser
2. Go to: carei-app.vercel.app/family/login
3. Enter your email and PIN
4. Tap "Add to Home Screen" when prompted
5. You're all set! 🎉

📱 Questions? Contact your care coordinator
```

### For Developers:

**Build Commands:**
```bash
# Build PWA (default)
npm run build

# Sync Android
cd android && ./gradlew assembleDebug

# Deploy to Vercel
vercel --prod
```

**Testing Mobile:**
```bash
# Start dev server
npm run dev

# Test on actual device (same network)
# Open: http://YOUR_IP:5173/family/login
```

---

## Security Notes 🔒

- All mobile access uses **HTTPS encryption**
- **PIN authentication** required (not just URL access)
- **Session timeout** after 30 minutes of inactivity
- **Automatic logout** on app close (optional)
- **Device fingerprinting** for additional security
- **Audit logging** of all family access

---

## Future Enhancements 🚀

### Planned Mobile Features:
- [ ] iOS Native App (Capacitor)
- [ ] Apple Push Notification Service (APNs)
- [ ] Widget Support (Android/iOS)
- [ ] Wear OS / Apple Watch app
- [ ] Siri / Google Assistant integration
- [ ] Family photo sharing (secure)
- [ ] Video calling with care team
- [ ] Location-based visit alerts

---

## Support 🚚

**Family Support:**
- In-app help: Family Settings → Help & Support
- Email: support@carei.app
- Phone: Available in app (taps to call)

**Technical Support:**
- Developer docs: `/docs`
- GitHub issues: Report bugs
- Vercel dashboard: Monitor deployments

---

*Last updated: July 2026*
*Version: 5.0.0*
