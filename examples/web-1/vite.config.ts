import { editable } from "@editable-jsx/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [...editable()]
})
