import localtunnel from 'localtunnel';
import { spawn } from 'child_process';

let tunnel;
let nextDev;
let isCleaningUp = false;

async function startDev() {
  // Start localtunnel and get URL
  tunnel = await localtunnel({ port: 3000 });
  console.log(`\n🌐 Local tunnel URL: ${tunnel.url}`);
  
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