import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false, // Skip DTS — deep leva/stitches type recursion
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "@editable-jsx/state",
    "@iconify/react",
    "@radix-ui/colors",
    "@radix-ui/react-context-menu",
    "@radix-ui/react-icons",
    "@stitches/react",
    "@use-gesture/react",
    "leva",
    "leva/plugin",
    "react-dropzone",
    "react-hot-toast",
    "react-hotkeys-hook",
    "tunnel-rat",
    "zustand"
  ]
})
