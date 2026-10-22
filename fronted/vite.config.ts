import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // 部署在 EC2（Node），不是 Cloudflare Workers：關掉 Cloudflare 打包目標，
  // `npm run build` 後用 `npm run start`（vite preview）跑正式版 SSR
  cloudflare: false,
  vite: {
    server: {
      port: 4173,
      host: "0.0.0.0",
      allowedHosts: true,
    },
    preview: {
      port: 4173,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  },
});
