/**
 * HMR client helpers — browser-side request/response over import.meta.hot.
 *
 * These provide a one-shot listener pattern that prevents listener leaks
 * and correctly pairs requests with responses.
 */

/**
 * Send an HMR request and wait for a single response.
 *
 * Registers a one-shot listener that removes itself after the first response.
 * If HMR is not available, rejects immediately.
 */
export function makeHmrRequest<TPayload, TResult>(
  sendEvent: string,
  resultEvent: string,
  payload: TPayload,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    if (!import.meta.hot) {
      reject(new Error("HMR not available"))
      return
    }

    const handler = (result: any) => {
      import.meta.hot!.off(resultEvent, handler)
      if (result && typeof result === "object" && "success" in result) {
        if (result.success) {
          resolve(result as TResult)
        } else {
          reject(new Error(result.error || "Request failed"))
        }
      } else {
        resolve(result as TResult)
      }
    }

    import.meta.hot!.on(resultEvent, handler)
    import.meta.hot!.send(sendEvent, payload as any)
  })
}

/**
 * Subscribe to HMR events pushed by the server.
 * Returns an unsubscribe function.
 */
export function makeHmrSubscription<T>(
  event: string,
  callback: (data: T) => void,
): () => void {
  if (!import.meta.hot) return () => {}

  const handler = (data: any) => callback(data as T)
  import.meta.hot.on(event, handler)

  return () => {
    import.meta.hot?.off(event, handler)
  }
}
