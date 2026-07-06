import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js handles JSX via SWC; Vitest uses Vite/esbuild, so enable the modern JSX runtime
  // to avoid requiring `import React from "react"` in every JSX file.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      components: fileURLToPath(new URL("./src/components", import.meta.url)),
      pages: fileURLToPath(new URL("./src/pages", import.meta.url)),
      styles: fileURLToPath(new URL("./src/styles", import.meta.url)),
      "test-utils": fileURLToPath(new URL("./src/test-utils", import.meta.url)),
      utils: fileURLToPath(new URL("./src/utils", import.meta.url)),
      widgets: fileURLToPath(new URL("./src/widgets", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Use forked processes (not worker threads) so each test file's heap is
    // reclaimed per process. Under vitest 4 the shared-heap thread pool
    // accumulated memory across the large jsdom suite and OOM-killed a worker;
    // forks with a bounded worker count keep peak memory stable. `poolOptions`
    // was removed in vitest 4's pool rework — the equivalent is the top-level
    // `maxWorkers` option (applies to whichever pool is active).
    pool: "forks",
    maxWorkers: 4,
    setupFiles: ["./vitest.setup.js"],
    include: ["src/**/*.test.{js,jsx}", "src/**/*.spec.{js,jsx}"],
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        // Ignore build artifacts / generated reports
        ".next/**",
        "coverage/**",
        // Exclude tests and test harness code from coverage totals.
        "src/**/*.test.{js,jsx,ts,tsx}",
        "src/**/*.spec.{js,jsx,ts,tsx}",
        "src/**/__tests__/**",
        "src/test-utils/**",
        "src/widgets/widgets.js",
        "src/widgets/components.js",
        "src/skeleton/custom.js",
        "next-i18next.config.js",
        "next.config.js",
        "postcss.config.js",
        "tailwind.config.js",
        "eslint.config.mjs",
        "vitest.config.mjs",
        ".prettierrc.js",
      ],
    },
  },
});
