# WebSocket Censorship Fix - Changes Summary

## 🎯 Problem
WebSocket connections blocked on censored networks while HTTP health API works fine (green status indicator shows but proxy fails).

## ✅ Solutions Implemented

### 1. **Port Change (Primary Fix)**
- **File**: `server.js`
- **Change**: Default port changed from `3000` → `443` (standard HTTPS)
- **Why**: Censorship systems block non-standard ports; 443 is universal HTTPS port
- **Action Required**: Redeploy server on port 443

### 2. **Frontend URL Update**
- **File**: `js/proxy-init.js`
- **Change**: Updated WebSocket URL to `wss://my-site.boxathome.net/wisp/` (no port specified = 443)
- **Why**: Sync with backend port change

### 3. **WebSocket Health Checker**
- **File**: `js/wisp-health.js` (NEW)
- **Purpose**: Diagnoses connectivity issues before initialization
- **Features**:
  - Tests WebSocket connection
  - Tests HTTP health endpoint
  - Provides detailed diagnosis
  - Gives actionable recommendations

### 4. **Evasion Techniques Module**
- **File**: `js/wisp-evasion.js` (NEW)
- **Purpose**: Advanced bypass techniques
- **Features**:
  - Connection retry with exponential backoff
  - Endpoint variation testing
  - Comprehensive bypass recommendations

### 5. **User-Facing Warning Banner**
- **Files**: `index.html`, `css/browser.css`, `js/proxy-init.js`
- **Purpose**: Notify users when WebSocket is blocked
- **Features**:
  - Beautiful gradient warning banner
  - Auto-hide after 10 seconds
  - Manual close button
  - Shows when HTTP works but WebSocket fails

### 6. **Comprehensive Documentation**
- **File**: `CENSORSHIP_BYPASS_GUIDE.md` (NEW)
- **Purpose**: Complete guide for deployment, testing, and troubleshooting
- **Covers**:
  - Deployment steps
  - Cloudflare setup (recommended)
  - Testing procedures
  - Debugging techniques
  - FAQ

## 📋 Deployment Checklist

### On Oracle Server:
```bash
# 1. Pull latest changes
cd /path/to/your/project
git pull origin main

# 2. Install dependencies (if needed)
npm install

# 3. Stop existing server
pm2 stop all  # or kill the process

# 4. Start on port 443
# Option A: Direct
sudo PORT=443 node server.js

# Option B: With PM2 (recommended)
sudo pm2 start server.js --name "proxy-443"
sudo pm2 save

# 5. Verify it's running
curl https://my-site.boxathome.net/api/health
```

### On GitHub Pages:
```bash
# 1. Commit and push all changes
git add .
git commit -m "Fix WebSocket censorship with port 443 + diagnostics"
git push origin main

# 2. Wait for GitHub Pages deployment (~1-2 minutes)

# 3. Test from censored network
# Open: https://burnedfart.github.io
# Check browser console for diagnostic messages
```

## 🔍 Testing

### Test 1: From Uncensored Network (Home)
1. Open https://burnedfart.github.io
2. Open browser console (F12)
3. Look for: `✅ [WISP-HEALTH] Connection successful`
4. No warning banner should appear
5. Try loading a website through proxy

### Test 2: From Censored Network (School/Work)
1. Open https://burnedfart.github.io
2. Open browser console (F12)
3. Look for diagnostic messages:
   ```
   🔬 [PROXY] Running WebSocket diagnostics...
   ❌ [WISP-HEALTH] Connection failed/timeout
   📊 [PROXY] Diagnosis: [detailed info]
   💡 [PROXY] Recommendations: [list]
   ```
4. Warning banner should appear if WebSocket blocked
5. Green status indicator may still show (HTTP works)

### Test 3: Manual Diagnostics
Open browser console and run:
```javascript
// Test WebSocket
await WispHealthChecker.testConnection('wss://my-site.boxathome.net/wisp/');

// Full diagnosis
await WispHealthChecker.diagnose(
  'wss://my-site.boxathome.net/wisp/',
  'https://my-site.boxathome.net/api/health'
);

// Get recommendations
console.table(WispEvasion.getBypassRecommendations());
```

## 🚀 Next Steps (If Port 443 Doesn't Work)

### Option A: Cloudflare (Highly Recommended)
1. Sign up at cloudflare.com
2. Add your domain `my-site.boxathome.net`
3. Enable WebSockets in Network settings
4. Update freedns.afraid.org to point to Cloudflare nameservers
5. Benefit from Cloudflare's global network (harder to block)

### Option B: Alternative Paths
Try different WebSocket paths that might not be blocked:
```javascript
// Test these manually:
await WispEvasion.findWorkingEndpoint(
  'wss://my-site.boxathome.net/wisp/',
  ['/wisp/', '/ws/', '/websocket/', '/api/ws/', '/']
);
```

### Option C: Domain Fronting
Use a CDN to disguise WebSocket traffic as requests to allowed domains (advanced).

### Option D: VPN Recommendation
If all else fails, recommend users use a VPN on the censored network.

## 📊 Expected Behavior

### Normal Network (No Censorship):
- ✅ HTTP health check: Success (green indicator)
- ✅ WebSocket connection: Success
- ✅ Diagnostic: "All systems operational!"
- ❌ Warning banner: Not shown
- ✅ Proxy: Works

### Censored Network (Before Fix):
- ✅ HTTP health check: Success (green indicator)
- ❌ WebSocket connection: Failed (port 3000 blocked)
- ⚠️ Proxy: Doesn't work

### Censored Network (After Fix - Best Case):
- ✅ HTTP health check: Success (green indicator)
- ✅ WebSocket connection: Success (port 443 allowed)
- ✅ Diagnostic: "All systems operational!"
- ❌ Warning banner: Not shown
- ✅ Proxy: Works

### Censored Network (After Fix - Worst Case):
- ✅ HTTP health check: Success (green indicator)
- ❌ WebSocket connection: Still failed (all WebSocket blocked)
- ⚠️ Diagnostic: "Network-level censorship detected"
- ✅ Warning banner: Shown with recommendations
- ❌ Proxy: Doesn't work (need Cloudflare or VPN)

## 📝 Files Modified

### Backend:
- `server.js` - Port 443

### Frontend:
- `js/proxy-init.js` - URL update + diagnostic integration
- `js/wisp-health.js` - NEW diagnostic tool
- `js/wisp-evasion.js` - NEW evasion techniques
- `index.html` - Added health checker script + warning banner
- `css/browser.css` - Warning banner styles

### Documentation:
- `CENSORSHIP_BYPASS_GUIDE.md` - NEW comprehensive guide
- `CHANGES_SUMMARY.md` - This file

## 💡 Key Insights

1. **Why Green Indicator But No Connection?**
   - HTTP health checks use standard HTTP protocol (allowed)
   - WebSocket uses upgrade protocol (can be blocked separately)
   - They're different protocols, can have different firewall rules

2. **Why Port 443 Helps?**
   - Firewalls often only allow ports 80 (HTTP) and 443 (HTTPS)
   - Port 3000 is obviously non-standard and easy to block
   - Port 443 makes WebSocket traffic look like normal HTTPS

3. **Why Encryption Matters?**
   - `wss://` (WebSocket Secure) encrypts traffic
   - Makes it harder for DPI to detect it's WebSocket
   - Unencrypted `ws://` is easily detected and blocked

4. **Why Cloudflare?**
   - Cloudflare IPs are trusted globally
   - Blocking Cloudflare breaks too many legitimate sites
   - Built-in DDoS protection as bonus

## 🆘 Support

If issues persist after deployment:

1. **Check server logs**: `pm2 logs proxy-443`
2. **Run diagnostics**: Open browser console and run health checks
3. **Test from different networks**: Isolate if it's network-specific
4. **Review guide**: `CENSORSHIP_BYPASS_GUIDE.md` has detailed troubleshooting
5. **Contact Mercury Workshop**: WISP/Scramjet creators (Discord/GitHub)

---

**Status**: Ready for deployment
**Priority**: High - Blocks proxy functionality on censored networks
**Risk**: Low - Changes are backward compatible
**Testing**: Required on both censored and uncensored networks
