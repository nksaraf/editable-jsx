import editableVite from "@editable-jsx/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [...editableVite.editable()]
})
