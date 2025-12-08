import { getRun } from "workflow/api"
import { consumeStreamState, STREAM_STATE_NAMESPACE } from "./server"
import tag from "@/lib/tag"

/**
 * Get readable streams for the given stream state IDs, filtered by permissions
 * Returns a record mapping streamId to ReadableStream
 */
export async function getStreamStateReadables<StreamId extends string>(
	streamIds: StreamId | StreamId[],
	options?: { startIndex?: number },
) {
	const streams = Array.isArray(streamIds) ? streamIds : [streamIds]

	const sources: Record<string, ReadableStream> = {}

	await Promise.all(
		streams.map(async (streamId) => {
			const runs = await tag.listRunsByTag(`stream:${streamId}`)
			const runId = runs?.at(0)
			if (!runId) return

			const run = getRun(runId)
			sources[streamId] = run.getReadable({
				namespace: STREAM_STATE_NAMESPACE,
				...(options?.startIndex !== undefined && {
					startIndex: options.startIndex,
				}),
			})
		}),
	)

	return sources
}

/**
 * Get the current state from a workflow stream (server-side)
 * Similar to useStreamState but for server components/actions
 * Uses tag-based lookup to find the runId from Redis
 *
 * Example:
 *   const { state, startIndex } = await getStreamState("public")
 */
export async function getStreamState<T = any>(
	streamId: string,
	options?: { initial?: T },
): Promise<{ state: T; startIndex: number }> {
	const readables = await getStreamStateReadables(streamId)
	const readable = readables[streamId]

	if (!readable) {
		if (options?.initial) {
			return { state: options.initial, startIndex: 0 }
		}
		throw new Error(`Workflow not found for tag: ${streamId}`)
	}

	const { state, count } = await consumeStreamState(readable, options?.initial)
	return { state, startIndex: count }
}
