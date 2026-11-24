import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deliberately not on `pnpm dev` (its script is `start`): this is a test bench,
// run with `pnpm --filter @booking/widget-demo start` beside the public site.
// Two pages: index.html (the script/`mount()` SDK) and react.html (the React SDK).
export default defineConfig({
  plugins: [react()],
  // @booking/widget-react is served as workspace source, so without this its
  // `react` import resolves apart from the demo's pre-bundled copy: two Reacts
  // on one page, and every hook fails ("Invalid hook call").
  resolve: { dedupe: ["react", "react-dom"] },
  server: { port: 5180 },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), react: resolve(__dirname, "react.html") },
    },
  },
});
