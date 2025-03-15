import localtunnel from 'localtunnel';
import { spawn } from 'child_process';

let tunnel;
let nextDev;
let isCleaningUp = false;

async function startDev() {
  // Start localtunnel and get URL
  tunnel = await localtunnel({ port: 3000 });
  let ip;
  try {
    ip = await fetch('https://ipv4.icanhazip.com').then(res => res.text()).then(ip => ip.trim());
  } catch (error) {
    console.error('Error getting IP address:', error);
  }

  console.log(`
🌐 Local tunnel URL: ${tunnel.url}

💻 To test on desktop:
   1. Open the localtunnel URL in your browser: ${tunnel.url}
   2. Enter your IP address in the password field${ip ? `: ${ip}` : ''} (note that this IP may be incorrect if you are using a VPN)
   3. Click "Click to Submit" -- your frame should now load in the browser
   4. Navigate to the Warpcast Frame Developer Tools: https://warpcast.com/~/developers/frames
   5. Enter your frame URL: ${tunnel.url}
   6. Click "Preview" to launch your frame within Warpcast (note that it may take ~10 seconds to load)


❗️ You will not be able to load your frame in Warpcast until    ❗️
❗️ you submit your IP address in the localtunnel password field ❗️


📱 To test in Warpcast mobile app:
   1. Open Warpcast on your phone
   2. Go to Settings > Developer > Frames
   4. Enter this URL: ${tunnel.url}
   5. Click "Launch" (note that it may take ~10 seconds to load)
`);
  
  // Start next dev with the tunnel URL as relevant environment variables
  nextDev = spawn('next', ['dev'], {
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_URL: tunnel.url, NEXTAUTH_URL: tunnel.url }
  });

  // Handle cleanup
  const cleanup = async () => {
    if (isCleaningUp) return;
    isCleaningUp = true;

    console.log('\n\nShutting down...');

    try {
      if (nextDev) {
        // Kill the main process first
        nextDev.kill('SIGKILL');
        // Then kill any remaining child processes in the group
        process.kill(-nextDev.pid);
        console.log('🛑 Next.js dev server stopped');
      }
      
      if (tunnel) {
        await tunnel.close();
        console.log('🌐 Tunnel closed');
      }

      // Force kill any remaining processes on port 3000
      try {
        if (process.platform === 'darwin') { // macOS
          await spawn('lsof', ['-ti', ':3000']).stdout.on('data', (data) => {
            data.toString().split('\n').forEach(pid => {
              if (pid) process.kill(parseInt(pid), 'SIGKILL');
            });
          });
        }
      } catch (e) {
        // Ignore errors if no process found
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      process.exit(0);
    }
  };

  // Handle process termination
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
  tunnel.on('close', cleanup);
}

startDev().catch(console.error); 