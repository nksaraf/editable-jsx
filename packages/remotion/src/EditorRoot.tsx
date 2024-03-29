import {
  EditableContext,
  EditableElement,
  useEditor
} from "@editable-jsx/editable"
import * as React from "react"
import { useId } from "react"

export function EditorRoot({
  children,
  element,
  ...props
}: {
  children: React.ReactNode
  element?: EditableElement
}) {
  const editor = useEditor()
  if (element) {
    // const ContextBridge = useContextBridge()

    React.useLayoutEffect(() => {
      element.index = "0"
      editor.rootId = element.id
    }, [element])

    // editor.ContextBridge = ContextBridge

    return (
      <EditableContext.Provider value={element}>
        {children}
      </EditableContext.Provider>
    )
  } else {
    // const ContextBridge = useContextBridge()
    const id = useId()

    const [editableElement, overrideProps] = editor.useElement("root", {
      id: "root" + id,
      ...props,
      children
    })

    React.useLayoutEffect(() => {
      editableElement.index = "0"
      editor.rootId = editableElement.id
    }, [editableElement])

    // editor.ContextBridge = ContextBridge
    return (
      <EditableContext.Provider value={editableElement}>
        {overrideProps.children}
      </EditableContext.Provider>
    )
  }
}
