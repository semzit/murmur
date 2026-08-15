import React from "react";
import { createRoot } from "react-dom/client";
import { MurmurProvider } from "@murmur/react";
import { runtime } from "./runtime.ts";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MurmurProvider coordinator={import.meta.env.VITE_COORDINATOR ?? "ws://localhost:8787"} options={{ runtime }}>
      <App />
    </MurmurProvider>
  </React.StrictMode>,
);
