import { redirect } from "next/navigation"
import tag from "@/lib/tag"

export default async function ChatPage() {
	// Get runs with the default channel tag
	const defaultRuns = await tag.listRunsByTag("channel:default")
	console.log("defaultRuns", defaultRuns)
	if (defaultRuns.length === 0) {
		// No default channel, stay on page to avoid redirect loop
		return null
	}

	// Get the ID tag for the first default run
	const defaultRun = defaultRuns[0]
	const channelId = await tag.getTag(defaultRun, "id")
	console.log("channelId", channelId)
	if (channelId) {
		redirect(`/chat/${channelId}`)
	}

	// No channel ID found, stay on page to avoid redirect loop
	return null
}
