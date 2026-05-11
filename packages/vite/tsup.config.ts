import { defineConfig } from "tsup"

export default defineConfig([
  // Server-side plugin (Node.js — Vite plugin, patcher, component scanner)
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
      "@babel/preset-typescript",
      "@editable-jsx/babel",
      "@editable-jsx/editable",
      "@editable-jsx/state",
      "@rolldown/plugin-babel",
      "@vitejs/plugin-react",
      "vite",
      "react",
      "react-dom",
      "ts-morph",
      "formidable",
      "fast-glob"
    ]
  },
  // Client-side RPC (browser — import.meta.hot)
  {
    entry: {
      client: "src/client.ts"
    },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    external: ["@editable-jsx/state"]
  },
  // Editor UI (browser — React component, ships with EditorPanel)
  {
    entry: {
      editor: "src/editor/index.ts"
    },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    // JSX needs esbuild to transform it
    jsx: "automatic",
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@editable-jsx/editable",
      "@editable-jsx/state"
    ]
  }
])
