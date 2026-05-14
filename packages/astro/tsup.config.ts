import { defineConfig } from "tsup"

export default defineConfig([
  // Server-side (Vite plugin, annotation transform, patcher)
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["vite", "@astrojs/compiler", "@editable-jsx/core", "@editable-jsx/css"],
  },
  // Client-side HMR bridge
  {
    entry: { client: "src/client.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
  },
  // Editor UI (vanilla JS)
  {
    entry: { editor: "src/editor/index.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
  },
])
