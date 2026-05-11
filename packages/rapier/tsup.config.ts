import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "three",
    "@react-three/fiber",
    "@react-three/rapier",
    "@editable-jsx/editable",
    "@editable-jsx/state",
    "@editable-jsx/ui"
  ]
})
