import { redirect } from "next/navigation"
import tag from "@/lib/tag"

export default async function ChannelsPage() {
	// Get runs with the default channel tag
	const defaultRuns = await tag.listRunsByTag("channel:default")

	if (defaultRuns.length === 0) {
		// No default channel, stay on page to avoid redirect loop
		return null
	}

	// Get the ID tag for the first default run
	const defaultRun = defaultRuns[0]
	const channelId = await tag.getTag(defaultRun, "id")

	if (channelId) {
		redirect(`/channels/${channelId}`)
	}

	// No channel ID found, stay on page to avoid redirect loop
	return null
}
