import { EditableElement } from "../../editable/EditableElement"
import { prop } from "../controls/prop"
import { geometry, meshGeometry } from "./geomtries"
import { material } from "./materials"
import {
  ambientLight,
  camera,
  directionalLight,
  orbitControls,
  pointLight,
  propControls,
  reactComponent,
  rigidBody,
  spotLight,
  transform,
  transformWithoutRef
} from "./plugins"

const mesh = {
  applicable: (object: any) => object.ref?.isMesh,
  controls: (element: EditableElement) => {
    return {
      castShadow: prop.bool({
        element,
        path: ["ref", "castShadow"]
      }),
      receiveShadow: prop.bool({
        element,
        path: ["ref", "receiveShadow"]
      })
    }
  }
}

export const DEFAULT_EDITOR_PLUGINS = [
  transform,
  reactComponent,
  rigidBody,
  transformWithoutRef,
  camera,
  mesh,
  material,
  geometry,
  meshGeometry,
  orbitControls,
  directionalLight,
  pointLight,
  ambientLight,
  spotLight,
  propControls
]

export function addPlugin(plugin: any) {
  if (!DEFAULT_EDITOR_PLUGINS.includes(plugin)) {
    DEFAULT_EDITOR_PLUGINS.push(plugin)
  }
}
