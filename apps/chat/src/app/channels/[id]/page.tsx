import { ChatClient } from "@/components/chat-client"
import { ChatNoAccess } from "@/components/chat-no-access"
import { auth } from "@workflow-chat/auth"
import { headers } from "next/headers"
import { getStreamState } from "@/lib/workflow-utils/stream-state/get-stream"
import tag from "@/lib/tag"

interface PageProps {
	params: Promise<{ id: string }>
}

export default async function ChannelPage({ params }: PageProps) {
	const { id: channelId } = await params

	const session = await auth.api.getSession({
		headers: await headers(),
	})

	const channels = await tag.listRunsByTag(`stream:${channelId}`, {
		OR: [
			"auth:public",
			session?.user ? "auth:private" : undefined,
			session?.user?.email ? `user:${session.user.email}` : undefined,
		].filter(Boolean) as string[],
	})

	if (!channels.length) {
		return <ChatNoAccess />
	}

	const { state: initialState, startIndex } = await getStreamState(channelId, {
		initial: {
			id: channelId,
			name: "",
			permission: "public" as const,
			createdAt: new Date().toISOString(),
			messages: [],
		},
	})

	return <ChatClient currentChannelId={channelId} initialState={initialState} startIndex={startIndex} />
}
