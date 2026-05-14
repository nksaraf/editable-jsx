import type { Plugin } from "vite"
import { createHotUpdateHandler } from "@editable-jsx/core"
import type { AstroEditorOptions } from "../types.js"
import { filesToSkipOnHmr } from "./hmr.js"
import { configureServer } from "./server.js"

export function createAstroEditorPlugin(
  options: AstroEditorOptions = {},
): Plugin {
  return {
    name: "editable-astro:server",
    enforce: "pre",
    configureServer: configureServer(options),
    handleHotUpdate: createHotUpdateHandler(filesToSkipOnHmr),
  }
}
