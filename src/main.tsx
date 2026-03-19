import { Buffer } from "buffer";
// Ensure Buffer exists before HashConnect loads (it assigns global.Buffer).
const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof g.Buffer === "undefined") {
  g.Buffer = Buffer;
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
