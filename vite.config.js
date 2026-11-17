import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Deployed at yoursite.com/big-numbers/
  base: "/big-numbers/",
  server: {
    port: 5173,
    open: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        atoms: resolve(__dirname, "atoms/index.html"),
        sand: resolve(__dirname, "sand/index.html"),
        trillion: resolve(__dirname, "trillion/index.html"),
        octillion: resolve(__dirname, "octillion/index.html"),
        twh: resolve(__dirname, "twh/index.html"),
      },
    },
  },
});
