import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CyberLab Studio — Vite-Setup mit React + Tailwind v4
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // bindet auf 0.0.0.0 → auch über 127.0.0.1 erreichbar (nicht nur IPv6 ::1)
    port: 5174,
    strictPort: true, // fester Port, kein Auto-Increment → URL bleibt verlässlich
    // Anfragen an /api gehen an den CyberLab-Studio-API-Dienst (Port 3001).
    // So spricht das Frontend relativ (/api/...) und es entsteht kein CORS.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
