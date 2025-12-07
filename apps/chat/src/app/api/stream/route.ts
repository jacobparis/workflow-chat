import { stream } from "@/lib/streaming/server"
import { getStreamReadables } from "@/lib/streaming/get-stream"
import { listRunsByTag } from "@/lib/workflow-utils/list-runs-by-tag"
import { auth } from "@workflow-chat/auth"
import { headers } from "next/headers"

export async function GET(req: Request) {
	const url = new URL(req.url)
	const streams = url.searchParams.getAll("stream")
	const startIndex = url.searchParams.get("startIndex")

	const session = await auth.api.getSession({
		headers: await headers(),
	})

	const allowedStreams = []
	for (const stream of streams) {
		const channels = await listRunsByTag(`stream:${stream}`, {
			OR: ["auth:public", session?.user ? "auth:private" : undefined].filter(Boolean) as string[],
		})

		if (channels.length) {
			allowedStreams.push(stream)
		}
	}

	const sources = await getStreamReadables(allowedStreams, {
		...(startIndex && { startIndex: Number.parseInt(startIndex, 10) }),
	})

	return stream(sources, { signal: req.signal })
}
