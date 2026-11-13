import { defineConfig } from "vite";

// Two builds of the same SDK, no dependencies in either:
//   `vite build`                → dist/booking-widget.es.js — `import { mount }` for sites with a bundler.
//   `vite build --mode script`  → dist/booking-widget.js    — a <script> tag on any website: sets
//                                  window.BookingWidget and mounts every [data-booking-widget] element.
export default defineConfig(({ mode }) => {
  const script = mode === "script";
  return {
    build: {
      lib: script
        ? { entry: "src/script.ts", name: "BookingWidget", formats: ["iife"], fileName: () => "booking-widget.js" }
        : { entry: "src/index.ts", formats: ["es"], fileName: () => "booking-widget.es.js" },
      // The second build adds to the first's output.
      emptyOutDir: !script,
      target: "es2019",
      sourcemap: true,
    },
  };
});
