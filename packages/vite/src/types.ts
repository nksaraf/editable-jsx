import { EditPatch } from "@editable-jsx/state"

export type ServerOptions = {
  componentsDir?: string
}

export type SaveResult = {
  success: boolean
  error?: string
}

export type ComponentInfo = {
  fileName: string
  components: string[]
}
