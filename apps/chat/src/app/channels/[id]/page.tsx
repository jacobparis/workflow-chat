import { ChatClient } from "@/components/chat-client"
import { ChatNoAccess } from "@/components/chat-no-access"
import { auth } from "@workflow-chat/auth"
import { headers } from "next/headers"
import { getStream } from "@/lib/streaming/get-stream"
import { listRunsByTag } from "@/lib/workflow-utils/list-runs-by-tag"

interface PageProps {
	params: Promise<{ id: string }>
}

export default async function ChannelPage({ params }: PageProps) {
	const { id: channelId } = await params

	const session = await auth.api.getSession({
		headers: await headers(),
	})

	const channels = await listRunsByTag(`stream:${channelId}`, {
		OR: [
			"auth:public",
			session?.user ? "auth:private" : undefined,
			session?.user?.email ? `user:${session.user.email}` : undefined,
		].filter(Boolean) as string[],
	})

	if (!channels.length) {
		return <ChatNoAccess />
	}

	const { state: initialState, startIndex } = await getStream(channelId, {
		initial: {
			id: channelId,
			name: "",
			permission: "public",
			createdAt: new Date().toISOString(),
			messages: [],
		},
	})

	return <ChatClient currentChannelId={channelId} initialState={initialState} startIndex={startIndex} />
}
