import { getRun } from "workflow/api"
import { consumeStream, STREAM_STATE_NAMESPACE } from "./server"
import { listRunsByTag } from "../workflow-utils/list-runs-by-tag"

/**
 * Get readable streams for the given stream IDs, filtered by permissions
 * Returns a record mapping streamId to ReadableStream
 */
export async function getStreamReadables<StreamId extends string>(
	streamIds: StreamId | StreamId[],
	options?: { startIndex?: number },
) {
	const streams = Array.isArray(streamIds) ? streamIds : [streamIds]

	const sources: Record<string, ReadableStream> = {}

	await Promise.all(
		streams.map(async (streamId) => {
			const runs = await listRunsByTag(`stream:${streamId}`)
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
 * Similar to useStream but for server components/actions
 * Uses tag-based lookup to find the runId from Redis
 *
 * Example:
 *   const { state, startIndex } = await getStream("public")
 */
export async function getStream<T = any>(
	streamId: string,
	options?: { initial?: T },
): Promise<{ state: T; startIndex: number }> {
	const readables = await getStreamReadables(streamId)
	const readable = readables[streamId]

	if (!readable) {
		if (options?.initial) {
			return { state: options.initial, startIndex: 0 }
		}
		throw new Error(`Workflow not found for tag: ${streamId}`)
	}

	const { state, count } = await consumeStream(readable, options?.initial)
	return { state, startIndex: count }
}
