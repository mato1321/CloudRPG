import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    ssr: {
      external: ["wrangler"]
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
});