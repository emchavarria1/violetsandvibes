import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ['src/main.tsx'],
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("react-router-dom") ||
            id.includes("@tanstack/react-query") ||
            id.includes("react-dom") ||
            id.includes("/react/")
          ) {
            return "framework";
          }

          if (id.includes("@supabase/")) {
            return "supabase";
          }

          if (id.includes("@radix-ui/")) {
            return "radix";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          return "vendor";
        },
      },
    }
  },
}));
