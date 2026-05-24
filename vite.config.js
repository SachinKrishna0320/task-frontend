import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Comma-separated hosts, or "all" to disable the check (behind ALB). */
function resolveAllowedHosts() {
  const fromEnv = process.env.VITE_ALLOWED_HOSTS;
  if (fromEnv === 'all' || fromEnv === 'true') return true;
  if (fromEnv) {
    return fromEnv.split(',').map((host) => host.trim()).filter(Boolean);
  }
  return ['.elb.amazonaws.com', 'localhost', '127.0.0.1'];
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: resolveAllowedHosts(),
    watch: { usePolling: true, interval: 500 },
    headers: {
      'Cache-Control': 'no-store',
    },
  },
});
