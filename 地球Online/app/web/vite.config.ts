import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: { rolldownOptions: { input: { main: "index.html", embed: "embed.html", lab: "hero-lab.html" } }, chunkSizeWarningLimit: 900 },
});
