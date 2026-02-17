# Test Execution & Production Traffic Monitoring Guide

## Overview

This guide provides step-by-step instructions for running the full test battery and monitoring live production traffic to the Farcaster MiniApp.

---

## Part 1: Test Execution

### Step 1: Install Dependencies

First, ensure all required testing dependencies are installed:

```bash
npm install
```

This includes:
- Jest (test framework)
- @testing-library/react (component testing)
- @testing-library/jest-dom (DOM assertions)

### Step 2: Run Unit Tests

#### Run all tests:
```bash
npm test
```

**Expected Output:**
```
PASS __tests__/api/users.test.ts
PASS __tests__/api/best-friends.test.ts
PASS __tests__/lib/errorUtils.test.tsx

Test Suites: 3 passed, 3 total
Tests: 12 passed, 12 total
```

#### Run tests in watch mode (for development):
```bash
npm run test:watch
```

#### Run tests with coverage report:
```bash
npm run test:coverage
```

**Expected Coverage:**
- Line Coverage: >85%
- Branch Coverage: >80%
- Function Coverage: >85%
- Statement Coverage: >85%

### Step 3: Production Test Cycle

Run the complete production test cycle:

```bash
npm run test:prod
```

This command:
1. Builds the app (`npm run build`)
2. Runs all tests (`npm test`)
3. Runs linting (`npm run lint`)

**Expected Result:** ✅ All three steps pass without errors

### Step 4: Build Verification

```bash
npm run build
```

**Expected Output:**
```
▲ Next.js 15.2.4
  ✓ Compiled successfully
  
info - Collected all build metrics during this build
```

**Key Metrics to Check:**
- Build completed in <60 seconds
- No TypeScript errors
- No ESLint warnings (or only minor non-blocking ones)

### Step 5: Type Checking

```bash
npx tsc --noEmit
```

**Expected Output:** (no output = success)

If there are errors, fix them before proceeding.

---

## Part 2: Running the Application

### Start Development Server

```bash
npm run dev
```

**Expected Output:**
```
↓ ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

Navigate to: **http://localhost:3000**

### Verify App Initialization

1. Open browser DevTools (F12)
2. Check Console tab:
   - Should show SDK initialization messages
   - No red errors
3. Check Network tab:
   - All resources loading (status 200)
   - No failed requests

### Test Splash Screen Behavior

1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Observe:
   - Splash screen appears
   - After ~1-2 seconds, splash screen disappears
   - App content becomes visible
   - No console errors

### Test Navigation

Click each tab and verify:
- ✅ **Home** - Displays correctly
- ✅ **Actions** - Functional
- ✅ **Context** - Shows system info
- ✅ **Wallet** - (if enabled) Connects wallet

---

## Part 3: Live Production Traffic Monitoring

### Setup 1: Enable Monitoring in Production

The monitoring system is already implemented. To verify it's working:

1. **Check monitoring file exists:**
   ```bash
   ls -la src/lib/monitoring.ts
   ```

2. **Verify logging API route:**
   ```bash
   curl http://localhost:3000/api/logs -X GET
   ```

   **Expected Response:**
   ```json
   {
     "message": "Log collecting endpoint for Farcaster MiniApp",
     "validTypes": ["api_request", "sdk_event", "performance", "error", "page_view", "user_interaction"]
   }
   ```

### Setup 2: Configure Logging Service (Optional)

To send logs to an external service, set environment variable:

```bash
# In .env.local or production environment
LOG_SERVICE_URL=https://your-logging-service.com/logs
```

Supported services:
- Datadog
- New Relic
- LogRocket
- Custom endpoint

### Setup 3: Monitor Live Traffic

#### In Browser Console

Open DevTools → Console and watch for monitoring messages:

```javascript
// You can manually test logging
fetch('/api/logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'api_request',
    data: {
      endpoint: '/test',
      method: 'GET',
      duration: 100,
      status: 200,
      timestamp: new Date().toISOString()
    }
  })
}).then(r => r.json()).then(console.log);
```

#### Monitor Server Logs

While dev server is running, logs appear in terminal:

```
[API_REQUEST] {
  timestamp: '2026-02-13T10:30:00Z',
  data: { endpoint: '/api/users', method: 'GET', duration: 245, status: 200 }
}

[SDK_EVENT] {
  timestamp: '2026-02-13T10:30:01Z',
  data: { event: 'ready', duration: 342 }
}
```

### Setup 4: Test Traffic Patterns

#### Simulate API Requests

```bash
# Test users endpoint
curl "http://localhost:3000/api/users?fids=1,2,3"

# Test best-friends endpoint
curl "http://localhost:3000/api/best-friends?fid=1"

# View logs
curl "http://localhost:3000/api/logs"
```

#### Monitor Response Times

Open DevTools → Network tab and measure:
- Page load (/) - Should be <2s
- API requests - Should be <500ms

#### Traffic Simulation Script

Create `test-traffic.sh` to simulate traffic:

```bash
#!/bin/bash

echo "Starting traffic simulation..."

for i in {1..10}; do
  echo "Request $i..."
  curl -s "http://localhost:3000/api/users?fids=$i" > /dev/null
  curl -s "http://localhost:3000/api/best-friends?fid=$i" > /dev/null
  sleep 1
done

echo "Traffic simulation complete"
```

Run with:
```bash
chmod +x test-traffic.sh
./test-traffic.sh
```

---

## Part 4: Production Deployment Monitoring

### Before Deploying

Run final test suite:
```bash
npm run test:prod
```

Verify:
- ✅ All tests pass
- ✅ Build succeeds
- ✅ No linting errors
- ✅ TypeScript types correct

### Deploy to Production

```bash
npm run deploy:vercel
```

Or use Vercel dashboard:
1. Push to main branch
2. Vercel auto-deploys
3. Monitor build logs

### Post-Deployment Monitoring

#### Monitor Error Rates

Check server logs for errors:
```
High error rate (>1%)? → Investigate
SDK failures? → Check Neynar integration
API timeouts? → Check external services
```

#### Performance Monitoring

Track these metrics daily:
- API response times
- Splash screen duration
- User interaction latency
- Memory usage

#### Health Check Endpoint

Create a health check script:

```bash
#!/bin/bash

echo "Health Check: $(date)"

# Check homepage
curl -s -o /dev/null -w "Homepage: %{http_code}\n" https://your-app.com

# Check API
curl -s -o /dev/null -w "API: %{http_code}\n" https://your-app.com/api/logs

# Check SDK integration
curl -s https://your-app.com | grep "sdk.actions.ready" && echo "SDK Ready: OK" || echo "SDK Ready: MISSING"
```

---

## Part 5: Analyzing Monitoring Data

### Key Metrics to Track

```
Metric                   Target    Action if Exceeded
─────────────────────────────────────────────────────
Error Rate              <1%       Investigate immediately
API Response Time       <500ms    Check external services
Splash Duration         <2s       Optimize SDK init
Memory Usage            <100MB    Check for leaks
SDK Init Success        >99%      Check Neynar status
```

### Log Analysis

View recent logs:
```bash
# Development
npm run dev -- --log-level debug

# Check production logs
curl https://your-logging-service.com/logs?last=1h
```

### Setting Up Alerts

For production, configure alerts for:

1. **Error Rate** - Alert if error_rate > 1%
2. **Response Time** - Alert if p95_response > 2s
3. **SDK Failures** - Alert if sdk_failures > 5/hr
4. **Downtime** - Alert if health_check fails

---

## Part 6: Troubleshooting

### Tests Failing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm test
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

### Monitoring Not Working

1. Check API logs route exists:
   ```bash
   ls src/app/api/logs/route.ts
   ```

2. Verify environment variables:
   ```bash
   echo $LOG_SERVICE_URL
   echo $NEYNAR_API_KEY
   ```

3. Check browser console for fetch errors

### Performance Issues

1. Run build with metrics:
   ```bash
   npm run build -- --debug
   ```

2. Analyze bundle:
   ```bash
   npx nx build -- --analyze
   ```

3. Check Core Web Vitals:
   - Open app in production
   - Run Lighthouse (Chrome DevTools)
   - Check performance metrics

---

## Part 7: Continuous Monitoring Checklist

### Daily Checks
- [ ] Error rate < 1%
- [ ] API response time < 500ms
- [ ] SDK initialization success > 99%
- [ ] No memory leaks
- [ ] Splash screen appears/disappears correctly

### Weekly Checks
- [ ] Review error logs for trends
- [ ] Check performance metrics
- [ ] Verify all API endpoints responding
- [ ] Test on multiple devices/browsers

### Monthly Checks
- [ ] Review security logs
- [ ] Check dependency updates
- [ ] Performance optimization review
- [ ] User experience assessment

---

## Summary

You now have a complete testing and monitoring setup:

✅ **Testing:**
- Unit tests with Jest
- Component tests with React Testing Library
- API route tests
- Automated test suite

✅ **Monitoring:**
- Client-side logging system
- Server-side log collection
- Performance metrics tracking
- Error logging and reporting

✅ **Production:**
- Automated alerts (configure externally)
- Traffic analysis
- Health checks
- Real-time monitoring

Run `npm run test:prod` to verify everything is working!

---

**Last Updated:** 2026-02-13
**Status:** ✅ Ready for Testing & Production Monitoring
