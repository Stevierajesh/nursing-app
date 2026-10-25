import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable on a phone home screen, which is the whole reason this is a
    // web app rather than React Native. Nurses add it once and it behaves like
    // a native app from then on.
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Salus",
        short_name: "Salus",
        description: "One tap to turn nursing intuition into an early warning.",
        // Must track --color-ink-900 in index.css, or the install splash and
        // the Android status bar frame a light app in the old dark navy.
        theme_color: "#f3f6f8",
        background_color: "#f3f6f8",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Never cache API responses: a stale patient list on a clinical device
        // is worse than a loading spinner.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
    // strictPort: fail loudly rather than drifting to the next free
  // port. A silent move puts the app outside the API's CORS
  // allowlist, which surfaces as confusing fetch failures.
  server: { port: 5173, strictPort: true },
});
