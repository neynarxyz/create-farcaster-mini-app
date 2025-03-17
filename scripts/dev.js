import localtunnel from 'localtunnel';
import { spawn } from 'child_process';

let tunnel;
let nextDev;
let isCleaningUp = false;

async function startDev() {
  // Check if port 3000 is already in use
  const isPortInUse = await checkPort(3000);
  if (isPortInUse) {
    console.error('Port 3000 is already in use. To find and kill the process using this port:\n\n' +
      '1. On macOS/Linux, run: lsof -i :3000\n' +
      '   On Windows, run: netstat -ano | findstr :3000\n\n' +
      '2. Note the PID (Process ID) from the output\n\n' + 
      '3. On macOS/Linux, run: kill -9 <PID>\n' +
      '   On Windows, run: taskkill /PID <PID> /F\n\n' +
      'Then try running this command again.');
    process.exit(1);
  }

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
        try {
          // Kill the main process first
          nextDev.kill('SIGKILL');
          // Then kill any remaining child processes in the group
          if (nextDev?.pid) {
            try {
              process.kill(-nextDev.pid);
            } catch (e) {
              // Ignore ESRCH errors when killing process group
              if (e.code !== 'ESRCH') throw e;
            }
          }
          console.log('🛑 Next.js dev server stopped');
        } catch (e) {
          // Ignore errors when killing nextDev
          console.log('Note: Next.js process already terminated');
        }
      }
      
      if (tunnel) {
        try {
          await tunnel.close();
          console.log('🌐 Tunnel closed');
        } catch (e) {
          console.log('Note: Tunnel already closed');
        }
      }

      // Force kill any remaining processes on port 3000
      try {
        if (process.platform === 'darwin') { // macOS
          const lsof = spawn('lsof', ['-ti', ':3000']);
          lsof.stdout.on('data', (data) => {
            data.toString().split('\n').forEach(pid => {
              if (pid) {
                try {
                  process.kill(parseInt(pid), 'SIGKILL');
                } catch (e) {
                  // Ignore ESRCH errors when killing individual processes
                  if (e.code !== 'ESRCH') throw e;
                }
              }
            });
          });
          // Wait for lsof to complete
          await new Promise((resolve) => lsof.on('close', resolve));
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