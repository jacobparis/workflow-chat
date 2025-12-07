import tag from "@/lib/tag"
import { auth } from "@workflow-chat/auth"
import { headers } from "next/headers"

export async function getUserChannels() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	const userEmail = session?.user?.email || ""
	const isLoggedIn = !!session?.user

	// Get all channel runs accessible to this user using tag queries
	// Runs must have 'channel' tag AND match at least one OR condition
	const accessibleRuns = await tag.listRunsByTag("channel", {
		OR: [
			userEmail ? `user:${userEmail}` : undefined,
			"channel:default",
			"auth:public",
			isLoggedIn ? "auth:private" : undefined,
		].filter((t): t is string => Boolean(t)),
	})

	if (accessibleRuns.length === 0) return []

	// Get channel data for each accessible run
	const channels = []
	for (const runId of accessibleRuns) {
		// Get stream ID from the 'id' tag (which stores the channel/stream ID)
		const streamId = await tag.getTag(runId, "id")
		if (!streamId) continue

		// Get channel name
		const name = await tag.getTag(runId, "name")
		if (!name) continue

		// Check if it's public by checking if run has auth:public tag
		const publicRuns = await tag.listRunsByTag("auth:public")
		const isPublic = publicRuns.includes(runId)

		// Get createdAt from the 'createdAt' tag if available, otherwise use current time
		const createdAt = (await tag.getTag(runId, "createdAt")) || new Date().toISOString()

		channels.push({
			id: streamId,
			name,
			permission: isPublic ? "public" : "private",
			createdAt,
		})
	}

	return channels
}
