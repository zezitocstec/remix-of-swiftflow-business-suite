import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      workbox: {
        // Precache only small/critical files. Big JS chunks (>2 MiB) are excluded
        // from the precache and instead handled by runtime caching (SWR) below,
        // so the SW install never blocks on huge bundles.
        globPatterns: ["**/*.{css,html,ico,png,svg,woff2}", "**/index-*.js"],
        globIgnores: [
          "**/assets/vendor-*.js",
          "**/assets/charts-*.js",
          "**/assets/pdf-*.js",
          "**/assets/*-large-*.js",
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024, // 2 MiB precache cap
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          // Big chunks served on-demand and refreshed in the background.
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "js-chunks-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/assets/") && url.pathname.endsWith(".css"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "css-chunks-cache",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "PDV - IT.Sega4 ",
        short_name: "PDV",
        description: "Sistema de Ponto de Venda rápido e offline",
        theme_color: "#2563eb",
        background_color: "#0a0f1e",
        display: "standalone",
        orientation: "any",
        start_url: "/pdv",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Manual chunking keeps the main bundle small and pushes heavy libs
        // into dedicated files that can stream on demand via runtime caching.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("react/") || id.includes("scheduler")) return "react";
          if (id.includes("react-router")) return "router";
          if (id.includes("@supabase") || id.includes("supabase-js")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("pdfmake")) return "pdf";
          if (id.includes("xlsx") || id.includes("papaparse")) return "spreadsheet";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns") || id.includes("dayjs")) return "dates";
          if (id.includes("@dnd-kit")) return "dnd";
          return "vendor";
        },
      },
    },
  },
}));
