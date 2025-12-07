import { redirect } from "next/navigation"
import { redis } from "@/lib/redis"
import { REDIS_PREFIX } from "@/lib/workflow-tags"

export default async function ChannelsPage() {
	// Get runs with the default channel tag
	const defaultRuns = await redis.lrange<string>(`${REDIS_PREFIX}tag:channel:default`, 0, -1)

	if (defaultRuns.length === 0) {
		// No default channel, stay on page to avoid redirect loop
		return null
	}

	// Find all stream tags and get the stream ID for the default run
	const streamTagKeys = (await redis.keys(`${REDIS_PREFIX}tag:stream:*`)).filter((key) =>
		key.startsWith(`${REDIS_PREFIX}tag:stream:`),
	)

	for (const tagKey of streamTagKeys) {
		const streamId = tagKey.replace(`${REDIS_PREFIX}tag:stream:`, "")
		const streamRuns = await redis.lrange<string>(tagKey, 0, -1)

		// Check if any default run belongs to this stream
		const defaultRun = streamRuns.find((runId) => defaultRuns.includes(runId))
		if (defaultRun) {
			redirect(`/channels/${streamId}`)
		}
	}

	// No default channel found, redirect to home
	redirect("/")
}
