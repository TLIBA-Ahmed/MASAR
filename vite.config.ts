import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'MASAR_');
  const apiPort = process.env.MASAR_API_PORT ?? environment.MASAR_API_PORT ?? '8000';
  if (!/^\d+$/.test(apiPort) || Number(apiPort) < 1024 || Number(apiPort) > 65535)
    throw new Error('MASAR_API_PORT must be a local port between 1024 and 65535.');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${apiPort}` } },
      watch: {
        ignored: [
          '**/.tmp/**',
          '**/.cache/**',
          '**/.venv/**',
          '**/.local-data/**',
          '**/infrastructure/model_artifacts/**',
          '**/document de referrence/**',
        ],
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});
