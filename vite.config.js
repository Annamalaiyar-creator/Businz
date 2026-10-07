import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import http from 'http'

// Vite plugin to automatically start the backend server on port 5001 if not already running
function autoStartBackendPlugin() {
  let backendProc = null;
  return {
    name: 'auto-start-backend',
    configureServer() {
      const checkBackend = () => {
        const req = http.get('http://localhost:5001/api/customers', (res) => {
          // Backend is already up and responding
        });
        req.on('error', () => {
          // Backend is not running, spawn it automatically
          if (!backendProc) {
            console.log('\n🚀 [Auto-Backend] Starting BUSINZ Node.js backend server on port 5001...');
            backendProc = spawn('node', ['server/index.js'], {
              stdio: 'inherit',
              shell: true
            });
            backendProc.on('exit', (code) => {
              console.log(`[Auto-Backend] Server process exited with code ${code}`);
              backendProc = null;
            });
          }
        });
        req.end();
      };

      checkBackend();
      const interval = setInterval(checkBackend, 10000);

      process.on('exit', () => {
        clearInterval(interval);
        if (backendProc) backendProc.kill();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), autoStartBackendPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
