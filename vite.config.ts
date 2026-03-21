import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
