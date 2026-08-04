import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/health": "http://localhost:8000",
      "/auth": "http://localhost:8000",
      "/ingest": "http://localhost:8000",
      "/ask": "http://localhost:8000",
      "/transcribe": "http://localhost:8000",
      // Trailing slash ensures bare /chat (React Router) is NOT proxied,
      // while /chat/sessions, /chat/basic, etc. still reach FastAPI.
      "/chat/": "http://localhost:8000",
    },
  },
});
