import { defineConfig } from "tsup"

export default defineConfig([
  // Server-side plugin (Node.js — Vite plugin, scanner, patcher)
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["vite", "postcss", "fast-glob", "@editable-jsx/core"],
  },
  // Client-side HMR bridge (browser — import.meta.hot)
  {
    entry: {
      client: "src/client.ts",
    },
    format: ["esm"],
    dts: false,
    sourcemap: true,
  },
  // Editor UI (browser — vanilla JS, no framework dependency)
  {
    entry: {
      editor: "src/editor/index.ts",
    },
    format: ["esm"],
    dts: false,
    sourcemap: true,
  },
])
