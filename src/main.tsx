import { Buffer } from "buffer";
// Ensure Buffer exists before HashConnect loads (it assigns global.Buffer).
const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof g.Buffer === "undefined") {
  g.Buffer = Buffer;
}

import "./index.css";
import { initApiFromRuntime } from "./lib/api";

async function boot() {
  await initApiFromRuntime();
  const [{ createRoot }, { default: App }] = await Promise.all([
    import("react-dom/client"),
    import("./App.tsx"),
  ]);
  createRoot(document.getElementById("root")!).render(<App />);
}

void boot();
