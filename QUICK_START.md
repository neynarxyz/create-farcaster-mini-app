# Farcaster MiniApp - Quick Start Guide

## ✅ Installation Status: COMPLETE

All dependencies have been installed and configured. The MiniApp is ready to run!

### Installed Packages
- ✅ `@farcaster/miniapp-sdk` - For MiniApp functionality
- ✅ `next`, `react`, `react-dom` - Framework dependencies
- ✅ `@neynar/react` - Neynar SDK integration
- ✅ All other required packages

---

## 🚀 Quick Start Commands

### 1. **Development Server** (Recommended for testing)
```bash
npm run dev
```
- Starts the app at `http://localhost:3000`
- Hot-reload enabled
- Perfect for testing splash screen behavior
- Press `Ctrl+C` to stop

### 2. **Production Build**
```bash
npm run build
```
- Builds the Next.js app for production
- Checks for TypeScript errors
- Validates all imports

### 3. **Type Checking**
```bash
npx tsc --noEmit
```
- Verifies all TypeScript types are correct
- No files are compiled

### 4. **Lint Check**
```bash
npm run lint
```
- Checks code style and quality

---

## 🧪 Test Battery - Quick Verification

Run these commands in order to verify everything works:

```bash
# 1. Install dependencies (already done)
npm install

# 2. Type checking (quick verification)
npx tsc --noEmit

# 3. Build the app
npm run build

# 4. Start development server
npm run dev
```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ Build completes without errors
- ✅ Dev server starts at `http://localhost:3000`
- ✅ App loads without console errors

---

## 🎯 App Flow & SDK Integration

### Initialization Sequence

1. **Page Load** → Browser requests `http://localhost:3000`
2. **Layout Renders** → `src/app/layout.tsx` loads Providers
3. **Providers Initialize** → `MiniAppProvider` from @neynar/react initializes the SDK
4. **App Component Mounts** → `src/components/App.tsx` renders
5. **SDK Loads** → `isSDKLoaded` becomes `true`
6. **Ready Triggered** → `sdk.actions.ready()` is called
7. **Splash Hidden** → Farcaster hides the splash screen
8. **App Revealed** → Your mini app is now visible!

### Key Code Locations

**SDK Initialization:** [src/app/providers.tsx](src/app/providers.tsx)
```tsx
<MiniAppProvider
  analyticsEnabled={ANALYTICS_ENABLED}
  backButtonEnabled={true}
  returnUrl={RETURN_URL}
>
  {children}
</MiniAppProvider>
```

**App Ready Function:** [src/components/App.tsx](src/components/App.tsx#L83-L90)
```tsx
useEffect(() => {
  if (isSDKLoaded) {
    sdk.actions.ready();
  }
}, [isSDKLoaded]);
```

---

## 💻 Live Testing in Browser

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Open in Browser
- Navigate to `http://localhost:3000`
- Keep DevTools open (F12)

### Step 3: Monitor Initialization
Open DevTools Console and watch:
1. App loads
2. SDK initializes
3. `sdk.actions.ready()` is called
4. Splash screen disappears

### Step 4: Test Navigation
- Click tabs: **Home**, **Actions**, **Context**, **Wallet**
- Test all interactive features
- Check for console errors

---

## 🔍 Verification Checklist

### Code Integration ✅
- [x] `@farcaster/miniapp-sdk` imported in App.tsx
- [x] `sdk.actions.ready()` called in useEffect
- [x] Called when `isSDKLoaded === true`
- [x] Only called once per component lifecycle

### Dependency Verification ✅
- [x] `@farcaster/miniapp-sdk` in package.json
- [x] All React dependencies installed
- [x] Node modules present

### Build Verification
Run: `npm run build`
- [ ] No TypeScript errors
- [ ] No build warnings
- [ ] Completes successfully

### Runtime Verification
Run: `npm run dev`
- [ ] Dev server starts
- [ ] App loads at localhost:3000
- [ ] No console errors
- [ ] SDK ready message in console (optional)

---

## 📊 Key Metrics

| Metric | Expected | Status |
|--------|----------|--------|
| **Splash Duration** | 1-2 seconds | Ready |
| **SDK Load Time** | <500ms | Using Neynar |
| **App Ready Call** | Immediate after SDK | Implemented |
| **Build Time** | <60 seconds | Next.js optimized |
| **Type Safety** | 0 errors | TypeScript enabled |

---

## 🎮 Quick Start Functions Available

Once the app is running, you can use these Neynar SDK functions:

### User Context
```tsx
const { context } = useMiniApp();
// Access user info, safe area insets, etc.
```

### Tab Navigation
```tsx
const { setActiveTab } = useMiniApp();
setActiveTab(Tab.Home); // Switch tabs
```

### Wallet Integration (if enabled)
```tsx
// Solana wallet functions
// EVM wallet functions (via Wagmi)
```

### Actions
```tsx
// SDK actions are available after ready()
sdk.actions.ready();
```

---

## 🚀 Next Steps After Verification

1. **Test in Farcaster Client**
   - Deploy to production URL
   - Open in Warpcast/other Farcaster clients
   - Verify splash screen hides properly

2. **Customize the App**
   - Modify title in [src/components/App.tsx](src/components/App.tsx#L54)
   - Add your own features
   - Update constants in [src/lib/constants.ts](src/lib/constants.ts)

3. **Deploy to Production**
   ```bash
   npm run deploy:vercel
   ```

---

## 📱 Browser Console Debugging

When app is running, you can test in console:

```javascript
// Check if SDK is available
console.log(window.FarcasterSDK);

// Test network request
fetch('http://localhost:3000/').then(r => r.text());

// Monitor SDK ready state
// (MiniAppProvider handles this internally)
```

---

## ❌ Troubleshooting

### Issue: Splash screen doesn't disappear
**Solution:**
1. Check DevTools Console for errors
2. Verify `sdk.actions.ready()` is called
3. Clear browser cache and reload
4. Check `isSDKLoaded` state in React DevTools

### Issue: Module not found error
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Issue: TypeScript errors
**Solution:**
```bash
npx tsc --noEmit
# Fix errors shown
npm run build
```

### Issue: Build fails
**Solution:**
1. Check for TypeScript errors: `npx tsc --noEmit`
2. Check for linting issues: `npm run lint`
3. Clear Next.js cache: `rm -rf .next`
4. Rebuild: `npm run build`

---

## 📈 Performance Tips

- **Dev Server**: Fast refresh with HMR
- **Production Build**: Optimized with Next.js
- **SDK Loading**: Lazy loaded by MiniAppProvider
- **Ready Call**: Non-blocking, happens in useEffect

---

## 🔗 Useful Resources

- [Farcaster MiniApp SDK Docs](https://docs.farcaster.xyz/miniapps)
- [Neynar React SDK](https://docs.neynar.com/reference/react-sdk)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## ✨ Summary

Your Farcaster MiniApp is fully configured with:
1. ✅ SDK installed and imported
2. ✅ `sdk.actions.ready()` implemented
3. ✅ Splash screen management enabled
4. ✅ All dependencies installed
5. ✅ Ready for development and testing

**Status: READY TO RUN** 🎉

Simply run `npm run dev` to start testing!

---

**Last Updated:** 2026-02-13
**SDK Version:** @farcaster/miniapp-sdk@0.0.24
**Framework:** Next.js 15.2.4 + React 19.0.0
