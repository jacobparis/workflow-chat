import { stream } from "@/lib/workflow-utils/stream-state/server"
import { getStreamStateReadables } from "@/lib/workflow-utils/stream-state/get-stream"
import tag from "@/lib/tag"
import { auth } from "@workflow-chat/auth"
import { headers } from "next/headers"
import { channelWorkflow } from "@/workflows/channel-workflow"
import { start } from "workflow/api"

// Ensure this workflow is started before the stream route is called
// This is idempotent because it's unique based on ID
void start(channelWorkflow, [
	{
		id: "public",
		name: "public",
		permission: "public",
		creatorEmail: "public",
		isDefault: true,
		initialMessages: [],
	},
])

export async function GET(req: Request) {
	const url = new URL(req.url)
	const streams = url.searchParams.getAll("stream")
	const startIndex = url.searchParams.get("startIndex")

	const session = await auth.api.getSession({
		headers: await headers(),
	})

	const allowedStreams = []
	for (const stream of streams) {
		const channels = await tag.listRunsByTag(`stream:${stream}`, {
			OR: ["auth:public", session?.user ? "auth:private" : undefined].filter(Boolean) as string[],
		})

		if (channels.length) {
			allowedStreams.push(stream)
		}
	}

	const sources = await getStreamStateReadables(allowedStreams, {
		...(startIndex && { startIndex: Number.parseInt(startIndex, 10) }),
	})

	return stream(sources, { signal: req.signal })
}
