import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
              return "vendor-react";
            }
            if (id.includes("@tanstack") || id.includes("axios")) {
              return "vendor-query";
            }
            if (id.includes("zod") || id.includes("react-hook-form")) {
              return "vendor-form";
            }
            if (id.includes("lucide-react") || id.includes("@radix-ui") || id.includes("sonner")) {
              return "vendor-ui";
            }
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.VITE_LOCAL_API_PORT ?? "8000"}`,
        changeOrigin: true,
      },
      "/storage": {
        target: `http://127.0.0.1:${process.env.VITE_LOCAL_API_PORT ?? "8000"}`,
        changeOrigin: true,
      },
    },
    // Ensure SPA fallback works for all routes when accessed via network IP
    fs: {
      strict: false,
    },
  },
  // Ensure proper handling of client-side routing
  appType: "spa",
});
