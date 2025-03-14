// import localtunnel from 'localtunnel';
import ngrok from 'ngrok';
import { spawn } from 'child_process';

let tunnel;
let nextDev;
let isCleaningUp = false;

async function startDev() {
  // Start ngrok and get URL
  tunnel = await ngrok.connect({
    addr: 3000,
  });
  console.log(`\n🌐 Ngrok tunnel URL: ${tunnel}`);
  
  // Start next dev with the tunnel URL as relevant environment variables
  nextDev = spawn('next', ['dev'], {
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_URL: tunnel, NEXTAUTH_URL: tunnel }
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
        // Comment out localtunnel cleanup
        // await tunnel.close();
        await ngrok.kill(); // Kill all ngrok processes
        console.log('\n🌐 Ngrok tunnel closed');
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
  // tunnel.on('close', cleanup); // Remove localtunnel event listener
}

startDev().catch(console.error); 