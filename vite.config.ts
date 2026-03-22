import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Mirrors production serve-static.mjs `/api-config.json` so initApiFromRuntime works in dev. */
function apiConfigDevPlugin(): Plugin {
  return {
    name: "api-config-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api-config.json") {
          next();
          return;
        }
        const apiUrl = process.env.VITE_API_URL ?? "";
        const wsUrl = process.env.VITE_WS_URL ?? "";
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ apiUrl, wsUrl }));
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // HashConnect v1 touches `global.Buffer` in the browser bundle
    global: "globalThis",
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && apiConfigDevPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    include: [
      "buffer",
      "@hashgraph/hashconnect",
      "@noble/hashes/sha3.js",
      "@noble/curves/secp256k1.js",
      "@noble/hashes/ripemd160.js",
      "@noble/hashes/sha256.js",
      "@noble/curves/abstract/utils.js",
      "@noble/curves/p256.js",
      "viem",
      "wagmi"
    ],
  },
}));
