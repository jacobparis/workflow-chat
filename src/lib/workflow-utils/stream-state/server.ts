import { getWritable } from "workflow"
import { compare, applyPatch } from "fast-json-patch"
import type { StreamMsg } from "./types"

const encoder = new TextEncoder()
export const STREAM_STATE_NAMESPACE = "stream-state"

/**
 * Initialize stream state with a replace message
 */
export async function initStreamStateStep<T>(state: T) {
	"use step"

	const writable = getWritable<StreamMsg<T>>({
		namespace: STREAM_STATE_NAMESPACE,
	})
	const writer = writable.getWriter()
	try {
		await writer.write({ type: "replace", state })
	} finally {
		writer.releaseLock()
	}
}

/**
 * Send a patch message if state has changed
 */
export async function patchStreamStateStep<T>(prev: T, next: T) {
	"use step"

	const patch = compare(prev as any, next as any)
	if (patch.length === 0) return

	const writable = getWritable<StreamMsg<T>>({
		namespace: STREAM_STATE_NAMESPACE,
	})
	const writer = writable.getWriter()
	try {
		await writer.write({ type: "patch", patch })
	} finally {
		writer.releaseLock()
	}
}

/**
 * Create a stream state manager that automatically sends replace/patch messages
 */
export function createStreamState<T>(initial: T): [T, () => Promise<void>] {
	let state: T = structuredClone(initial)
	let committed: T | null = null

	async function update() {
		if (committed === null) {
			await initStreamStateStep(state)
			committed = structuredClone(state)
			return
		}

		await patchStreamStateStep(committed, state)
		committed = structuredClone(state)
	}

	return [state, update]
}

/**
 * Return an SSE Response from a workflow ReadableStream<StreamMsg<T>>
 * or a Record of namespaced streams
 *
 * Example:
 *   return stream(await getWorkflowStream(roomId), { signal: request.signal })
 *   return stream({ "channel:public:state": readable }, { signal: request.signal })
 */
export function stream<T extends StreamMsg>(
	readableOrSources: ReadableStream<T> | Record<string, ReadableStream<StreamMsg>>,
	opts?: { signal?: AbortSignal },
): Response {
	const signal = opts?.signal

	if (!readableOrSources) {
		return new Response(encoder.encode("event: end\ndata: {}\n\n"), {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		})
	}

	// Convert single stream to Record format for unified handling
	const sources: Record<string, ReadableStream<StreamMsg>> = readableOrSources instanceof ReadableStream
		? { "": readableOrSources }
		: readableOrSources

	// If no streams, return a keep-alive connection (empty streams are valid when caught up)
	const readers = Object.entries(sources).map(([event, readable]) => {
		// Single stream (empty event) has no event field
		// Record streams use the event as event type (workflow tag)
		return { reader: readable.getReader(), event }
	})

	let cancelled = false
	const sse = new ReadableStream<Uint8Array>({
		start(controller) {
			const releaseAllReaders = () => {
				readers.forEach(({ reader }) => {
					try {
						reader.releaseLock()
					} catch {
						// Reader already released
					}
				})
				readers.length = 0
			}

			const onAbort = () => {
				cancelled = true
				// Don't cancel readers here - let pending reads complete naturally
				// The pump will clean up when it checks the cancelled flag
				try {
					controller.close()
				} catch {
					// Controller already closed
				}
			}

			if (signal) {
				if (signal.aborted) {
					releaseAllReaders()
					onAbort()
					return
				}
				signal.addEventListener("abort", onAbort)
			}

			// Send initial connection event to acknowledge the stream is ready
			// This prevents the browser from hanging when startIndex is used
			try {
				controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"))
			} catch {
				// Controller already closed
			}

			const pump = async (): Promise<void> => {
				// Only close if cancelled, not if readers naturally exhausted
				if (cancelled) {
					if (signal) {
						signal.removeEventListener("abort", onAbort)
					}
					releaseAllReaders()
					try {
						controller.enqueue(encoder.encode("event: end\ndata: {}\n\n"))
						controller.close()
					} catch {
						// Already closed
					}
					return
				}

				// No readers - keep connection open, nothing to pump
				if (readers.length === 0) {
					return
				}

				try {
					// Read from all streams concurrently
					const readPromises = readers.map(async ({ reader, event }) => {
						try {
							const { value, done } = await reader.read()
							if (done) {
								return { type: "done" as const, event }
							}
							return { type: "value" as const, value, event }
						} catch (error) {
							// Only log if not cancelled (cancellation errors are expected)
							if (!cancelled) {
								console.error(`Error reading from ${event || "stream"}:`, error)
							}
							return { type: "error" as const, event }
						}
					})

					const results = await Promise.all(readPromises)

					// Check if cancelled after reads complete
					if (cancelled) {
						releaseAllReaders()
						onAbort()
						return
					}

					// Process results and remove done readers
					const activeReaders: typeof readers = []
					for (let i = 0; i < results.length; i++) {
						const result = results[i]
						const readerInfo = readers[i]

						if (result.type === "done") {
							readerInfo.reader.releaseLock()
						} else if (result.type === "error") {
							readerInfo.reader.releaseLock()
						} else {
							activeReaders.push(readerInfo)

							// Check if aborted before enqueueing
							if (signal?.aborted) {
								releaseAllReaders()
								onAbort()
								return
							}

							// Format as SSE with optional event field
							const payload = result.value
							const dataLine = `data: ${JSON.stringify(payload)}\n`
							const eventLine = result.event ? `event: ${result.event}\n` : ""

							try {
								controller.enqueue(encoder.encode(`${eventLine}${dataLine}\n`))
							} catch (e) {
								// Controller closed, stop pumping
								releaseAllReaders()
								onAbort()
								return
							}
						}
					}

					readers.length = 0
					readers.push(...activeReaders)

					// Check if cancelled before continuing
					if (cancelled) {
						releaseAllReaders()
						onAbort()
						return
					}

					// Continue pumping if there are active readers
					if (readers.length > 0) {
						void pump()
					}
					// When all streams end naturally (not cancelled), keep connection open
					// The workflow streams return done:true when caught up to startIndex
					// Don't close - let client handle reconnection if needed
				} catch (error) {
					console.error("Error in stream pump:", error)
					releaseAllReaders()
					onAbort()
				}
			}

			void pump()
		},
		cancel() {
			// Stream cancelled - set flag and let pump clean up
			cancelled = true
		},
	})

	return new Response(sse, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	})
}

/**
 * Consume a stream state and return the final state value and message count
 * Only reads messages that are already available, then terminates
 * Workflow streams are continuous and never end, so we read what's buffered and stop
 *
 * Uses an efficient pattern: reads in a tight loop with a resettable timeout.
 * After each message, the timeout resets. If no message arrives within the
 * timeout window, we've consumed all buffered data.
 *
 * Example:
 *   const { state, count } = await consumeStreamState(await getWorkflowStream(roomId))
 */
export async function consumeStreamState<T>(
	readable: ReadableStream<StreamMsg<T>>,
	initial?: T,
): Promise<{ state: T; count: number }> {
	const reader = readable.getReader()
	let state: T = (initial ?? {}) as T
	let count = 0

	try {
		const gapTimeout = 50 // 50ms gap indicates all buffered data consumed
		let timeoutId: NodeJS.Timeout | null = null
		let gapResolve: (() => void) | null = null

		// Create a resettable gap promise that resolves when no message arrives
		const createGapPromise = (): Promise<void> => {
			return new Promise((resolve) => {
				if (timeoutId) clearTimeout(timeoutId)
				gapResolve = resolve
				timeoutId = setTimeout(() => {
					gapResolve = null
					resolve()
				}, gapTimeout)
			})
		}

		// Start reading with gap detection
		let gapPromise = createGapPromise()

		while (true) {
			const readPromise = reader.read()
			const result = await Promise.race([
				readPromise.then((r) => ({ type: "read" as const, value: r })),
				gapPromise.then(() => ({ type: "gap" as const })),
			])

			if (result.type === "gap") {
				// Gap detected - all buffered data consumed
				break
			}

			const { value, done } = result.value
			if (done) break

			if (value) {
				count++
				// Reset gap timer - we received a message, so more might be buffered
				gapPromise = createGapPromise()

				// Apply the message to state
				if (value.type === "replace") {
					state = value.state
				} else if (value.type === "patch") {
					state = applyPatch(structuredClone(state), value.patch as any).newDocument as T
				}
			}
		}

		// Clean up timeout
		if (timeoutId) clearTimeout(timeoutId)
	} finally {
		reader.releaseLock()
	}

	return { state, count }
}
