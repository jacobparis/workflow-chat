import { listRunsByTag } from "./list-runs-by-tag"
import { getTagForRun } from "./get-tag"
import { redis } from "../redis"
import { REDIS_PREFIX } from "../workflow-tags"

export interface Channel {
	id: string
	name: string
	permission: "public" | "private"
	createdAt: string
}

export async function getUserChannels(userEmail: string): Promise<Channel[]> {
	// Get all runs accessible to this user (user tag OR default channel tag)
	const [userRuns, defaultRuns] = await Promise.all([
		redis.lrange<string>(`${REDIS_PREFIX}tag:user:${userEmail}`, 0, -1),
		redis.lrange<string>(`${REDIS_PREFIX}tag:channel:default`, 0, -1),
	])
	const accessibleRuns = new Set([...userRuns, ...defaultRuns])

	if (accessibleRuns.size === 0) return []

	// Find all stream tags and get the stream ID for each accessible run
	const streamTagKeys = (await redis.keys(`${REDIS_PREFIX}tag:stream:*`)).filter((key) =>
		key.startsWith(`${REDIS_PREFIX}tag:stream:`),
	)

	const channelMap = new Map<string, { runId: string; name: string | null }>()

	for (const tagKey of streamTagKeys) {
		const streamId = tagKey.replace(`${REDIS_PREFIX}tag:stream:`, "")
		const streamRuns = await redis.lrange<string>(tagKey, 0, -1)

		// Check if any accessible run belongs to this stream
		const accessibleRun = streamRuns.find((runId) => accessibleRuns.has(runId))
		if (!accessibleRun) continue

		// Get channel name
		const name = await getTagForRun(accessibleRun, "name")
		channelMap.set(streamId, { runId: accessibleRun, name })
	}

	// Build channel list
	const channels: Channel[] = []
	for (const [streamId, { runId, name }] of channelMap) {
		if (!name) continue

		// Check permission
		const publicRuns = await redis.lrange<string>(`${REDIS_PREFIX}tag:auth:public`, 0, -1)
		const isPublic = publicRuns.includes(runId)

		channels.push({
			id: streamId, // Use stream ID as channel ID
			name,
			permission: isPublic ? "public" : "private",
			createdAt: new Date().toISOString(),
		})
	}

	return channels.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
