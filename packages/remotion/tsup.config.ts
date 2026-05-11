import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "@editable-jsx/commander",
    "@editable-jsx/editable",
    "@editable-jsx/panels",
    "@editable-jsx/state",
    "@editable-jsx/ui",
    "@editable-jsx/vite",
    "@remotion/player",
    "@remotion/three"
  ]
})
