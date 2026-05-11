import { levaStore } from "leva"
import { DataInput, StoreType } from "leva/dist/declarations/src/types"
import { create, type StoreApi, type UseBoundStore } from "zustand"

export { LevaInputs as InputTypes, levaStore as defaultStore } from "leva"
export type { StoreApi, UseBoundStore as Store } from "zustand"

export type ControlledStore = Omit<StoreType, "useStore"> & {
  useStore: UseBoundStore<StoreApi<{ data: { [key: string]: DataInput } }>>
}

export const createControlledStore = (): ControlledStore => {
  return new (Object.getPrototypeOf(levaStore).constructor)()
}
export function createStore<T extends object>(
  name: string,
  fn: (set: StoreApi<T>["setState"], get: StoreApi<T>["getState"]) => T
): UseBoundStore<StoreApi<T>> {
  return create<T>(fn as any)
}
