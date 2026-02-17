# Farcaster MiniApp SDK - Testing Guide

This guide provides a comprehensive testing procedure for validating the Farcaster MiniApp SDK integration and `sdk.actions.ready()` functionality.

## Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

This will install:
- `@farcaster/miniapp-sdk` v0.0.24 - For MiniApp functionality and splash screen management
- `next` - Next.js framework
- `react` and `react-dom` - React dependencies
- `@neynar/react` - Neynar SDK integration

### 2. Verify Installation
```bash
npm list @farcaster/miniapp-sdk
npm list next react react-dom
```

Expected output:
```
@farcaster/miniapp-sdk@0.0.24
next@15.2.4
react@19.0.0
react-dom@19.0.0
```

## Manual Testing Steps

### 1. Development Server
Start the development server:
```bash
npm run dev
```

The app should start at `http://localhost:3000`

**Expected behavior:**
- Page loads with a splash screen initially
- After SDK initialization completes, `sdk.actions.ready()` is called
- Splash screen hides and reveals the main app content
- Console shows no errors related to `@farcaster/miniapp-sdk`

### 2. Check SDK Integration
Open your browser's DevTools (F12) and check:

**Console Verification:**
```javascript
// In browser console, verify the SDK is accessible:
typeof window.FarcasterSDK // should not be undefined if loaded
```

**Network Tab:**
- Verify `@farcaster/miniapp-sdk` is loaded without 404 errors
- Look for module imports from `node_modules`

### 3. Test Splash Screen Behavior
The critical test for `sdk.actions.ready()`:

1. Open the app in a Farcaster client or simulator
2. Observe the splash screen that appears on initial load
3. After ~1-2 seconds, the splash screen should disappear
4. The main app UI should become visible
5. You should see the "Neynar Starter Kit" title and tabs

### 4. Build Verification
```bash
npm run build
```

**Expected output:**
- No build errors
- No TypeScript errors related to `@farcaster/miniapp-sdk`
- Build completes successfully

### 5. Type Safety Check
```bash
npx tsc --noEmit
```

**Expected output:**
- No TypeScript errors
- All imports properly resolved

## Integration Points Tested

### Files Modified
1. **package.json**
   - Added `@farcaster/miniapp-sdk` to dependencies

2. **src/components/App.tsx**
   - Imported `sdk` from `@farcaster/miniapp-sdk`
   - Added `useEffect` hook that calls `sdk.actions.ready()` when `isSDKLoaded` is true

### Code Flow
1. Component mounts
2. `useMiniApp()` hook initializes Neynar SDK
3. When `isSDKLoaded` becomes `true`:
   - Sets initial tab to "Home"
   - Calls `sdk.actions.ready()` to reveal the app (splash screen is hidden)

## Testing Checklist

### Unit-Level Tests
- [ ] `@farcaster/miniapp-sdk` is installed
- [ ] `@farcaster/miniapp-sdk` module resolves without errors
- [ ] App component imports the `sdk` correctly
- [ ] TypeScript compilation succeeds

### Integration Tests
- [ ] App loads without console errors
- [ ] sdk.actions.ready() is called during app initialization
- [ ] Splash screen is hidden after SDK initialization
- [ ] Main app content is visible
- [ ] All tabs (Home, Actions, Context, Wallet) are functional

### Functional Tests
- [ ] App initializes in Farcaster client
- [ ] SDK ready event is triggered
- [ ] Splash screen behavior works as expected
- [ ] App display is not blocked after ready() is called

## Troubleshooting

### Module Not Found Error
```
Cannot find module '@farcaster/miniapp-sdk'
```
**Solution:** Run `npm install` again, then reload the development server

### Splash Screen Still Visible
- Check that `sdk.actions.ready()` is being called
- Verify `isSDKLoaded` state is true
- Check browser console for SDK errors
- Clear browser cache and reload

### TypeScript Errors
```
Type 'sdk' is not assignable...
```
**Solution:** 
- Delete `node_modules` and `.next` folder
- Run `npm install` again
- Restart the dev server

## Performance Notes

- `sdk.actions.ready()` should be called within 100-500ms of SDK initialization
- The function is non-blocking and doesn't impact app performance
- Ensure it's called exactly once per app lifecycle (handled by useEffect dependency)

## Next Steps

After successful testing:
1. Deploy to production
2. Monitor splash screen behavior in production Farcaster clients
3. Set up error tracking for SDK initialization failures
4. Test on multiple Farcaster clients (Web, Mobile)

---

**Last Updated:** 2026-02-13
**SDK Version:** @farcaster/miniapp-sdk@0.0.24
