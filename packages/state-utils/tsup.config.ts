import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false, // leva types cause infinite recursion in TS checker
  sourcemap: true,
  clean: true,
  external: ["react", "xstate", "@xstate/react", "leva", "leva/plugin", "zustand"]
})
