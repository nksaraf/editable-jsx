import { FC, forwardRef, ReactNode, Ref, useContext, useMemo } from "react"
import { EditorContext } from "./EditorContext"

type Elements = {
  [K in keyof JSX.IntrinsicElements]: FC<
    JSX.IntrinsicElements[K] & {
      ref?: Ref<any>
    }
  >
}

const memo = new WeakMap() as unknown as WeakMap<Elements, any> & Elements

export const setEditable = (
  component: any,
  editable: (props: any) => ReactNode
) => {
  if (typeof component === "string") {
    // @ts-ignore
    memo[component] = editable
  } else if (typeof component === "symbol") {
    // @ts-ignore
    memo[component] = editable
  } else {
    memo.set(component, editable)
  }
}

export const getEditable = (component: any) => {
  if (typeof component === "string") {
    // @ts-ignore
    return memo[component]
  } else if (typeof component === "symbol") {
    // @ts-ignore
    return memo[component]
  } else {
    return memo.get(component)
  }
}

export const Editable = forwardRef(
  ({ __component, ...props }: { __component: any }, ref) => {
    const editor = useContext(EditorContext)
    const EditableComponent = useMemo(() => {
      if (editor) {
        if (__component.$$typeof === Symbol.for("react.provider")) {
          return __component
        }

        if (!getEditable(__component) && editor) {
          setEditable(__component, createEditable(__component))
        }
        return getEditable(__component)
      }
      return __component
    }, [__component, editor])

    return <EditableComponent {...props} ref={ref} />
  }
)

Editable.displayName = "Editable"

export function createEditable<K extends keyof JSX.IntrinsicElements, P = {}>(
  Component: any
) {
  let hasRef =
    // @ts-ignore
    typeof Component === "string" ||
    (Component as any).$$typeof === Symbol.for("react.forward_ref") ||
    ((Component as any).$$typeof === Symbol.for("react.memo") &&
      Component["type"]?.["$$typeof"] === Symbol.for("react.forward_ref"))

  if (hasRef) {
    const Editable = forwardRef(function Editable(props: any, forwardRef) {
      const editor = useContext(EditorContext)
      console.log(editor)
      if (!editor) {
        if (typeof editor !== "function") {
          return <Component {...props} ref={forwardRef} />
        } else {
          return Component(props, forwardRef)
        }
      }

      console.log(Component, props, forwardRef)

      return editor.renderElement(Component, props, forwardRef ?? true)
    })
    Editable.displayName = `Editable(ForwardRef(${
      typeof Component === "string"
        ? Component
        : Component.displayName || Component.name
    }))`
    return Editable
  } else {
    function Editable(props: any) {
      const editor = useContext(EditorContext)
      console.log(editor)
      if (!editor) return <Component {...props} />

      return editor.renderElement(Component, props, false)
    }

    Editable.displayName = `Editable(ForwardRef(${
      typeof Component === "string"
        ? Component
        : Component.displayName || Component.name
    }))`
    return Editable as FC<P>
  }
}

export const editable = new Proxy(memo, {
  get: (target: any, key: any) => {
    const value = target[key]
    if (value) {
      return value
    }
    const newValue = createEditable(key)
    target[key] = newValue as any
    return newValue
  }
})
