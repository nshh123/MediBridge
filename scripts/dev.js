import { spawn } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';

console.log('\n============================================================');
console.log('  MediBridge — Smart E-Prescription & Pharmacy Stock Network');
console.log('  Starting Backend API (Port 4000) + React UI (Port 5173)...');
console.log('============================================================\n');

const serverProc = spawn('node', ['server/src/index.js'], {
  stdio: 'inherit',
  shell: isWin,
  env: { ...process.env, PORT: process.env.PORT || '4000' }
});

const clientProc = spawn('npx', ['vite', '--port', '5173'], {
  stdio: 'inherit',
  shell: isWin
});

function shutdown() {
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
