import { useEffect, useState } from "react"
import "./App.css"
import reactLogo from "./assets/react.svg"
import viteLogo from "/vite.svg"

import { EditableElement, Editor, EditorProvider } from "@editable-jsx/editable"

class WebEditor extends Editor {
  constructor() {
    super([])
  }

  useElement(
    _Component: any,
    props: any,
    forwardRef?: any
  ): [EditableElement<any>, any] {
    const [el, p] = super.useElement(_Component, props, forwardRef)

    useEffect(() => {
      // console.log(forwardRef.current)
      // if (forwardRef.current) {
      //   forwardRef.current!.style.backgroundColor = "red"
      // }
      function eventListener() {
        el.ref.style.backgroundColor = "red"
      }

      el.ref!.addEventListener("click", eventListener)

      return () => {
        el.ref!.removeEventListener("click", eventListener)
      }
    }, [forwardRef])

    return [el, p]
  }
}

globalThis.editor ??= new WebEditor()

function App() {
  const [count, setCount] = useState(0)

  return (
    <EditorProvider editor={editor}>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </EditorProvider>
  )
}

export default App
