import { defineConfig } from "tsup"

export default defineConfig([
  // Server-side (Node — patch orchestration, HMR suppression)
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  // Client-side (browser — HMR request helpers)
  {
    entry: { client: "src/hmr/client.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
  },
])
