import tag from "@/lib/tag"

export interface Channel {
	id: string
	name: string
	permission: "public" | "private"
	createdAt: string
}

export async function getUserChannels(userEmail: string): Promise<Channel[]> {
	// Get all runs accessible to this user (user tag OR default channel tag)
	const [userRuns, defaultRuns] = await Promise.all([
		tag.listRunsByTag(`user:${userEmail}`),
		tag.listRunsByTag("channel:default"),
	])
	const accessibleRuns = new Set([...userRuns, ...defaultRuns])

	if (accessibleRuns.size === 0) return []

	// Find all stream tag keys and extract stream IDs
	// Stream tags are in format: tag:stream:{streamId}
	const streamTagKeys = await tag.getKeys(`tag:stream:*`)
	const streamIds = streamTagKeys
		.map((key) => {
			// Extract stream ID from key (format: {prefix}tag:stream:{streamId})
			const match = key.match(/tag:stream:(.+)$/)
			return match ? match[1] : null
		})
		.filter((id): id is string => id !== null)

	const channelMap = new Map<string, { runId: string; name: string | null }>()

	for (const streamId of streamIds) {
		const streamRuns = await tag.listRunsByTag(`stream:${streamId}`)

		// Check if any accessible run belongs to this stream
		const accessibleRun = streamRuns.find((runId) => accessibleRuns.has(runId))
		if (!accessibleRun) continue

		// Get channel name
		const name = await tag.getTag(accessibleRun, "name")
		channelMap.set(streamId, { runId: accessibleRun, name })
	}

	// Build channel list
	const channels: Channel[] = []
	for (const [streamId, { runId, name }] of channelMap) {
		if (!name) continue

		// Check permission
		const publicRuns = await tag.listRunsByTag("auth:public")
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
