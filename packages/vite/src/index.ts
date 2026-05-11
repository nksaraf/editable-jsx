import { PluginItem, types as t } from "@babel/core"
import { JSXElementType, reactThreeEditorBabel } from "@editable-jsx/babel"
import babel from "@rolldown/plugin-babel"
import react from "@vitejs/plugin-react"
import type { PluginOption } from "vite"

type FilterPattern = string | RegExp | (string | RegExp)[]
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
  /**
   * Glob/regex patterns for files to include in the Babel transform.
   * @default ["**\/*.tsx", "**\/*.jsx"]
   */
  include?: FilterPattern
  /**
   * Glob/regex patterns for files to exclude from the Babel transform.
   * @default [/node_modules/]
   */
  exclude?: FilterPattern
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
  react: includeReact = true,
  include: userInclude,
  exclude: userExclude
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
      include: userInclude ?? ["**/*.tsx", "**/*.jsx"],
      exclude: userExclude ?? [/node_modules/],
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
