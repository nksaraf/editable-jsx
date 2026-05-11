import { PluginItem, types as t } from "@babel/core"
import { JSXElementType, reactThreeEditorBabel } from "@editable-jsx/babel"
import babel from "@rolldown/plugin-babel"
import react from "@vitejs/plugin-react"
import type { PluginOption } from "vite"
import { editor } from "./server"

let shouldEdit = (_node: JSXElementType) => {
  return true
}

export type PluginOptions = {
  babelPlugins?: PluginItem[]
  editable?: (node: JSXElementType) => boolean
  componentsDir?: string
  enabled?: boolean
  /**
   * Include @vitejs/plugin-react in the returned plugin array.
   * Set to false when the consuming vite.config already has react().
   * @default true
   */
  react?: boolean
}

/**
 * Returns the editable-jsx Vite plugins.
 *
 * Standalone usage (includes react()):
 *   plugins: [...editable()]
 *
 * With an existing react() plugin:
 *   plugins: [react(), ...editable({ react: false })]
 */
export function editable({
  babelPlugins = [],
  editable: isEditable = shouldEdit,
  enabled = true,
  componentsDir = "src/components",
  react: includeReact = true
}: PluginOptions = {}): PluginOption[] {
  if (!enabled) {
    return includeReact ? [react()] : []
  }

  const plugins: PluginOption[] = [editor()]

  if (includeReact) {
    plugins.push(react())
  }

  plugins.push(
    babel({
      include: ["**/*.tsx", "**/*.jsx"],
      exclude: [/node_modules/],
      plugins: [
        ...babelPlugins,
        [
          reactThreeEditorBabel,
          {
            replaceImports: {},
            imports: {
              path: "@editable-jsx/editable",
              imports: ["editable", "Editable"]
            },
            isEditable
          }
        ]
      ]
    })
  )

  return plugins
}
