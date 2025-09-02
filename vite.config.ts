import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages配信時はワークフローが YOJIJUKUGO_BASE=/yojijukugo/ を与える
  base: process.env.YOJIJUKUGO_BASE ?? '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
