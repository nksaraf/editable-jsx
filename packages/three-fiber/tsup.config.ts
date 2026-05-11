import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    fiber: "src/fiber/index.ts",
    vite: "src/vite.ts"
  },
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "@editable-jsx/commander",
    "@editable-jsx/editable",
    "@editable-jsx/panels",
    "@editable-jsx/state",
    "@editable-jsx/ui",
    "@editable-jsx/vite",
    "its-fine",
    "suspend-react",
    "hash-sum",
    "leva",
    "zustand"
  ]
})
