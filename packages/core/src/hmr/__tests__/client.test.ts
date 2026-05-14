import { describe, expect, test } from "bun:test"

/**
 * The HMR client uses `import.meta.hot` which is a Vite-only browser API.
 * Bun does not allow reassigning `import.meta.hot`, so we can't mock it
 * directly. Instead, we test the timeout and settling logic by extracting
 * the core patterns used in makeHmrRequest.
 *
 * These tests verify the timeout/cancellation behavior that was added
 * to prevent the UI from hanging forever when the server never responds.
 */

/** Minimal reproduction of the makeHmrRequest pattern, without import.meta.hot */
function makeRequestWithTimeout<T>(
  send: (onResult: (result: any) => void, onOff: () => void) => void,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`HMR request timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    send(
      (result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (result && typeof result === "object" && "success" in result) {
          if (result.success) {
            resolve(result as T)
          } else {
            reject(new Error(result.error || "Request failed"))
          }
        } else {
          resolve(result as T)
        }
      },
      () => {
        /* off handler */
      },
    )
  })
}

describe("HMR request timeout behavior", () => {
  test("resolves on success response", async () => {
    const result = await makeRequestWithTimeout<{ success: boolean; v: number }>(
      (onResult) => {
        setTimeout(() => onResult({ success: true, v: 42 }), 5)
      },
      1000,
    )
    expect(result).toEqual({ success: true, v: 42 })
  })

  test("rejects on error response", async () => {
    await expect(
      makeRequestWithTimeout(
        (onResult) => {
          setTimeout(() => onResult({ success: false, error: "bad" }), 5)
        },
        1000,
      ),
    ).rejects.toThrow("bad")
  })

  test("rejects with timeout error when server never responds", async () => {
    await expect(
      makeRequestWithTimeout(
        () => {
          /* server never responds */
        },
        50,
      ),
    ).rejects.toThrow("HMR request timed out after 50ms")
  })

  test("does not double-settle if response arrives after timeout", async () => {
    let resolveCount = 0
    let rejectCount = 0

    try {
      await makeRequestWithTimeout(
        (onResult) => {
          // Arrives after timeout
          setTimeout(() => onResult({ success: true }), 100)
        },
        30,
      )
      resolveCount++
    } catch {
      rejectCount++
    }

    // Should only have rejected once (the timeout)
    expect(rejectCount).toBe(1)
    expect(resolveCount).toBe(0)

    // Wait for the late response to fire (should be a no-op)
    await new Promise((r) => setTimeout(r, 150))
  })

  test("resolves plain result without success field", async () => {
    const result = await makeRequestWithTimeout<string>(
      (onResult) => {
        setTimeout(() => onResult("hello"), 5)
      },
      1000,
    )
    expect(result).toBe("hello")
  })
})
