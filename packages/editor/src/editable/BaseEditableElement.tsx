import { FC, PropsWithChildren } from "react"

import { EditableElementContext } from "./EditableElement"
import { Helpers } from "./Helpers"
import { useEditor } from "./useEditor"

export type EditableElementProps = PropsWithChildren<{
  component: any
  props: any
  forwardRef?: any
  children?: any
  root?: boolean
}>

export const BaseEditableElement: FC<EditableElementProps> = ({
  component,
  props,
  forwardRef,
  root
}: EditableElementProps) => {
  const editor = useEditor()
  const [editableElement, editableProps] = editor.useElement(
    component,
    props,
    forwardRef
  )

  if (root) {
    editor.rootId = editableElement.id
  }

  if (editableElement.forwardedRef) {
    return (
      <EditableElementContext.Provider value={editableElement}>
        <editableElement.type {...editableProps} />
        {editableElement.mounted && <Helpers />}
      </EditableElementContext.Provider>
    )
  } else {
    return (
      <EditableElementContext.Provider value={editableElement}>
        <editableElement.type {...editableProps} />
        <Helpers />
      </EditableElementContext.Provider>
    )
  }
}