// IISNode CommonJS entrypoint for Windows Plesk hosting
import('./server/index.js').catch((err) => {
  console.error('[IISNode Startup Error]:', err);
  process.exit(1);
});
