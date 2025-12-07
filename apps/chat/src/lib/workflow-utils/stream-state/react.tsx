"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useSyncExternalStore } from "react"
import { applyPatch } from "fast-json-patch"
import type { StreamMsg } from "./types"

type Listener = () => void

type StreamSource = {
	count: number
	eventCount: number
	listeners: Set<Listener>
	state: any
}

type StreamSourceMap = Map<string, StreamSource>

type EventSourceValue = {
	count: number
	source: EventSource
	handlers: Map<string, Set<(event: MessageEvent) => void>>
}

type EventSourceMap = Map<string, EventSourceValue>

const EventSourceContext = createContext<EventSourceMap>(new Map<string, EventSourceValue>())

export const EventSourceProvider = EventSourceContext.Provider

type StreamContextValue = {
	map: StreamSourceMap
	url: string
}

const StreamStateContext = createContext<StreamContextValue>({
	map: new Map<string, StreamSource>(),
	url: "/api/stream",
})

export function StreamStateProvider({ children, url = "/api/stream" }: { children: React.ReactNode; url?: string }) {
	const [map] = useState(() => new Map<string, StreamSource>())
	const [eventSourceMap] = useState(() => new Map<string, EventSourceValue>())

	// Clean up all streams on HMR or unmount
	useEffect(() => {
		if (typeof window === "undefined") return

		const cleanup = () => {
			// Close all EventSource connections
			for (const value of eventSourceMap.values()) {
				if (value.source.readyState !== EventSource.CLOSED) {
					value.source.close()
				}
			}
			eventSourceMap.clear()
			map.clear()
		}

		// Listen for HMR in development
		if (process.env.NODE_ENV === "development") {
			// Next.js HMR detection
			if (typeof module !== "undefined") {
				const hotModule = module as typeof module & { hot?: { dispose: (callback: () => void) => void } }
				if (hotModule.hot) {
					hotModule.hot.dispose(() => {
						cleanup()
					})
				}
			}

			// Fallback: listen for beforeunload (fires during HMR)
			const handleBeforeUnload = () => {
				cleanup()
			}
			window.addEventListener("beforeunload", handleBeforeUnload)

			return () => {
				window.removeEventListener("beforeunload", handleBeforeUnload)
			}
		}

		// Cleanup on unmount
		return cleanup
	}, [eventSourceMap, map])

	return (
		<EventSourceProvider value={eventSourceMap}>
			<StreamStateContext.Provider
				value={{
					map,
					url,
				}}
			>
				{children}
			</StreamStateContext.Provider>
		</EventSourceProvider>
	)
}

export function useStreamState<T = any>(workflowId: string, options?: { initial?: T; startIndex?: number }): T {
	const [initial] = useState(() => options?.initial ?? ({} as T))
	const { map, url } = useContext(StreamStateContext)
	const eventSourceMap = useContext(EventSourceContext)

	// Create a unique key for this stream
	const streamKey = workflowId
	const key = useMemo(() => `stream:${streamKey}`, [streamKey])
	const eventType = useMemo(() => streamKey, [streamKey])

	// Get or create the stream source
	const source = useMemo(() => {
		let streamSource = map.get(key)

		if (!streamSource) {
			streamSource = {
				count: 0,
				eventCount: options?.startIndex ?? 0,
				listeners: new Set(),
				state: initial,
			}
			map.set(key, streamSource)
		} else if (options?.startIndex !== undefined && streamSource.eventCount === 0) {
			// Initialize eventCount from startIndex if not already set
			streamSource.eventCount = options.startIndex
		}

		return streamSource
	}, [key, initial, map, options?.startIndex])

	// Build the EventSource URL - only use initial startIndex, not eventCount
	// eventCount will be used when reconnecting after cancellation
	const streamUrl = useMemo(() => {
		if (!workflowId) return null
		const params = new URLSearchParams()
		params.set("stream", streamKey)
		if (options?.startIndex !== undefined) {
			params.set("startIndex", String(options.startIndex))
		}
		return `${url}?${params.toString()}`
	}, [url, streamKey, workflowId, options?.startIndex])

	// Manage EventSource connection with reference counting
	useEffect(() => {
		if (!streamUrl || typeof window === "undefined") {
			return undefined
		}

		// Build the actual URL to use - use current eventCount if we've received events,
		// otherwise use the initial startIndex from options
		const actualStartIndex = source.eventCount > 0 ? source.eventCount : options?.startIndex
		const params = new URLSearchParams()
		params.set("stream", streamKey)
		if (actualStartIndex !== undefined) {
			params.set("startIndex", String(actualStartIndex))
		}
		const actualStreamUrl = `${url}?${params.toString()}`

		// Create a key for the EventSource (URL + credentials)
		const eventSourceKey = actualStreamUrl

		let value = eventSourceMap.get(eventSourceKey)

		if (!value) {
			const eventSource = new EventSource(actualStreamUrl)
			value = {
				count: 0,
				source: eventSource,
				handlers: new Map(),
			}
			eventSourceMap.set(eventSourceKey, value)

			// Set up error handler
			eventSource.addEventListener("error", (event: Event) => {
				const target = event.target as EventSource
				if (target.readyState === EventSource.CLOSED) {
					console.warn("Stream closed")
				} else if (target.readyState === EventSource.CONNECTING) {
					console.error("Stream connection failed", target.url)
				}
			})
		}

		++value.count

		// Create handler for this specific event type
		const handler = (event: MessageEvent) => {
			try {
				const msg: StreamMsg = JSON.parse(event.data)

				if (msg.type === "replace") {
					source.state = msg.state
				} else if (msg.type === "patch") {
					source.state = applyPatch(structuredClone(source.state), msg.patch as any).newDocument
				}

				// Increment event count for each stream message received
				source.eventCount++

				source.listeners.forEach((listener) => listener())
			} catch (e) {
				console.error("Failed to parse SSE message:", e)
			}
		}

		// Register handler for this event type
		if (!value.handlers.has(eventType)) {
			value.handlers.set(eventType, new Set())
		}
		value.handlers.get(eventType)!.add(handler)
		value.source.addEventListener(eventType, handler)

		return () => {
			const handlerSet = value.handlers.get(eventType)
			if (handlerSet) {
				handlerSet.delete(handler)
				if (handlerSet.size === 0) {
					value.handlers.delete(eventType)
				}
			}
			value.source.removeEventListener(eventType, handler)
			--value.count
			if (value.count <= 0) {
				value.source.close()
				eventSourceMap.delete(eventSourceKey)
			}
		}
	}, [streamUrl, eventType, eventSourceMap, source, streamKey, url, options?.startIndex])

	// Increment/decrement count for this stream source
	useEffect(() => {
		if (typeof window === "undefined") return

		source.count++

		return () => {
			source.count--

			// Clean up if no longer used
			if (source.count <= 0) {
				map.delete(key)
			}
		}
	}, [source, key, map])

	const subscribe = (listener: Listener) => {
		source.listeners.add(listener)
		return () => {
			source.listeners.delete(listener)
		}
	}

	// Use a ref to cache the snapshot and only create a new object when state changes
	const snapshotRef = useRef<{ state: any; snapshot: T } | null>(null)

	const getSnapshot = () => {
		const currentState = source.state

		// Only create a new snapshot if state reference changed
		if (!snapshotRef.current || snapshotRef.current.state !== currentState) {
			snapshotRef.current = {
				state: currentState,
				snapshot: currentState as T,
			}
		}

		return snapshotRef.current.snapshot
	}

	const getServerSnapshot = () => {
		const currentState = source.state

		// Only create a new snapshot if state reference changed
		if (!snapshotRef.current || snapshotRef.current.state !== currentState) {
			snapshotRef.current = {
				state: currentState,
				snapshot: currentState as T,
			}
		}

		return snapshotRef.current.snapshot
	}

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
