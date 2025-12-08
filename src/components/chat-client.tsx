"use client"

import { ChatMessage } from "@/components/chat-message"
import { MessageInput } from "@/components/message-input"
import { SignInPrompt } from "@/components/sign-in-prompt"
import { authClient } from "@/lib/auth-client"
import { useStreamState } from "@/lib/workflow-utils/stream-state/react"
import { type ChannelState } from "@/workflows/channel-workflow"
import { sendMessage } from "@/workflows/send-message-hook"

interface ChatClientProps {
	currentChannelId: string
	initialState?: ChannelState
	startIndex?: number
}

export function ChatClient({ currentChannelId, initialState, startIndex }: ChatClientProps) {
	const { data: session } = authClient.useSession()
	const isGuest = !session

	// Consume channel state stream
	const channelState = useStreamState(currentChannelId || "", {
		initial: initialState || {
			id: currentChannelId,
			messages: [],
		},
		startIndex,
	})

	const messages = channelState.messages

	const handleSendMessage = async (content: string) => {
		try {
			await sendMessage({ content, channelId: currentChannelId })
		} catch (error) {
			console.error("Failed to send message:", error)
		}
	}

	return (
		<div className="flex flex-col flex-1 min-h-0 bg-background">
			<div className="flex-1 overflow-y-auto flex flex-col">
				{messages.length === 0 ? (
					<div className="flex-1 flex items-center justify-center text-muted-foreground">
						No messages yet. {isGuest ? "Sign in to start chatting!" : "Be the first to send a message!"}
					</div>
				) : (
					messages.map((message, index) => {
						const previousMessage = index > 0 ? messages[index - 1] : null
						const showHeader = !previousMessage || previousMessage.username !== message.username
						return (
							<ChatMessage
								key={message.id}
								username={message.username}
								avatarUrl={message.avatarUrl}
								content={message.content}
								timestamp={message.timestamp}
								showHeader={showHeader}
							/>
						)
					})
				)}
			</div>
			{isGuest ? <SignInPrompt /> : <MessageInput onSend={handleSendMessage} />}
		</div>
	)
}
