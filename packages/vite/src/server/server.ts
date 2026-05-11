import { EditPatch } from "@editable-jsx/state"
import formidable from "formidable"
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { ViteDevServer } from "vite"
import { applyPatches } from "../patcher"
import { ServerOptions } from "../types"
import { listComponents } from "./components"

const configureMiddlewares = (server: ViteDevServer) => {
  server.middlewares.use("/__editor/save", async (req, res) => {
    let response = await new Promise<string>((resolve, reject) => {
      formidable({
        multiples: true,
        keepExtensions: true,
        filename(name, ext, part, form) {
          return req.url!.slice(1)
        }
      }).parse(req, (err, fields, files) => {
        if (err) {
          reject(err)
        }

        const texturepath = `public/textures/${decodeURIComponent(
          req.url!.slice(1)
        )}`

        // Ensure target directory exists
        mkdirSync(dirname(texturepath), { recursive: true })

        if (existsSync(texturepath)) {
          rmSync(texturepath)
        }

        renameSync((files as any)["file"]!.filepath, texturepath)

        resolve(
          JSON.stringify(
            "/textures/" + decodeURIComponent(req.url!.slice(1)),
            null,
            2
          )
        )
      })
    })

    res.setHeader("Content-Type", "application/json")
    res.end(response)
  })
}

export const configureServer = (options: ServerOptions) => {
  return (server: ViteDevServer) => {
    // Use Vite 5+ HMR channel API (server.hot) instead of deprecated server.ws
    server.hot.on("editable-jsx:save", async (data: EditPatch | EditPatch[], client) => {
      try {
        if (!data) {
          throw new Error("no data")
        }
        if (!Array.isArray(data)) {
          data = [data]
        }
        await applyPatches(data)
        client.send("editable-jsx:save:result", { success: true })
      } catch (error: any) {
        client.send("editable-jsx:save:result", {
          success: false,
          error: error.message
        })
      }
    })

    server.hot.on("editable-jsx:components", async (_data: any, client) => {
      try {
        const componentsDir = resolve(
          process.cwd(),
          "src",
          "components",
          "**/*.{tsx,jsx}"
        )
        const components = await listComponents(componentsDir)
        client.send("editable-jsx:components:result", components)
      } catch (error) {
        console.log("something went wrong while initializing the watcher")
        client.send("editable-jsx:components:result", [])
      }
    })

    // Expose helper endpoints for client filesystem operations
    configureMiddlewares(server)
  }
}
