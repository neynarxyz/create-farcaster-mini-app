import localtunnel from 'localtunnel';
import { spawn } from 'child_process';

let tunnel;
let nextDev;
let isCleaningUp = false;

async function startDev() {
  // Start localtunnel and get URL
  tunnel = await localtunnel({ port: 3000 });
  console.log(`
🌐 Local tunnel URL: ${tunnel.url}

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

    try {
      if (nextDev) {
        nextDev.kill();
        console.log('\n🛑 Next.js dev server stopped');
      }
      
      if (tunnel) {
        await tunnel.close();
        console.log('\n🌐 Tunnel closed');
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
  tunnel.on('close', cleanup);
}

startDev().catch(console.error); 