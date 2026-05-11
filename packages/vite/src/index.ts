import { PluginItem, types as t } from "@babel/core"
import { JSXElementType, reactThreeEditorBabel } from "@editable-jsx/babel"
import babel from "@rolldown/plugin-babel"
import react from "@vitejs/plugin-react"
import { editor } from "./server"

let shouldEdit = (_node: JSXElementType) => {
  return true
}

export type PluginOptions = {
  babelPlugins?: PluginItem[]
  editable?: (node: JSXElementType) => boolean
  componentsDir?: string
  enabled?: boolean
}

export function editable({
  babelPlugins = [],
  editable: isEditable = shouldEdit,
  enabled = true,
  componentsDir = "src/components"
}: PluginOptions = {}) {
  return enabled
    ? [
        editor(),
        react(),
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
      ]
    : [react()]
}
