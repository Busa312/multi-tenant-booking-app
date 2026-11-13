import { defineConfig } from "vite";

// dist/booking-widget-react.js — React and the core widget stay external: the
// app brings its own React, and @booking/widget is a dependency.
export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "booking-widget-react.js" },
    target: "es2019",
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "@booking/widget"],
      // Next.js App Router: the components touch the DOM, so they must be
      // client components. Rollup drops module-level directives while
      // bundling, so the build puts one back at the top of the file.
      output: { banner: '"use client";' },
      onwarn(warning, warn) {
        // …and the sourcemap can't point at a directive it removed.
        if (warning.code === "MODULE_LEVEL_DIRECTIVE" || warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
    },
  },
});
