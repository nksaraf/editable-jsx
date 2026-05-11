import { defineConfig } from "tsup"

export default defineConfig([
  {
    entry: {
      index: "src/index.ts"
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
      "@babel/core",
      "@editable-jsx/babel",
      "@editable-jsx/state",
      "@rolldown/plugin-babel",
      "@vitejs/plugin-react",
      "vite",
      "react",
      "react-dom",
      "ts-morph",
      "formidable",
      "fs-extra",
      "fast-glob"
    ]
  },
  {
    entry: {
      client: "src/client.ts"
    },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    external: ["@editable-jsx/state"]
  }
])
