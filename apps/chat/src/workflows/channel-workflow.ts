import { defineHook, getWorkflowMetadata } from "workflow"
import { createStreamingState } from "@/lib/streaming/server"
import { setTag } from "@/lib/workflow-tags"
import { muxEvents } from "@/lib/mux-events"

export interface Message {
	id: string
	content: string
	username: string
	avatarUrl: string | null
	timestamp: string
}

export interface ChannelState {
	id: string
	name: string
	permission: "public" | "private"
	createdAt: string
	messages: Message[]
}

export const messageHook = defineHook<{
	content: string
	username: string
	avatarUrl?: string | null
}>()

export const joinChannelHook = defineHook<{
	userEmail: string
}>()

export async function channelWorkflow({
	id,
	name,
	permission,
	creatorEmail,
	isDefault = false,
	initialMessages = [],
}: {
	id: string
	name: string
	permission: "public" | "private"
	creatorEmail: string
	isDefault?: boolean
	initialMessages: {
		content: string
		username: string
		avatarUrl?: string | null
		id?: string
		timestamp?: string
	}[]
}) {
	"use workflow"
	// This is the only workflow for the channel
	await setTag(`stream:${id}`, { unique: true })
	// Tag with the channel name
	await setTag("channel")
	await setTag("id", id)
	await setTag("name", name)

	// Set auth tag based on channel permission
	await setTag(permission === "public" ? "auth:public" : "auth:private")

	// Tag with creator's user ID
	await setTag(`user:${creatorEmail}`)

	// Tag as default channel if specified
	if (isDefault) {
		await setTag("channel:default")
	}

	const createdAt = new Date().toISOString()
	const [state, updateState] = createStreamingState({
		id,
		name: "",
		permission,
		createdAt,
		messages: initialMessages.map((m) => ({
			...m,
			id: m.id || crypto.randomUUID(),
			timestamp: m.timestamp || new Date().toISOString(),
		})),
	})

	if (!state.name) {
		// set in a separate step so the user receives a patch including the name
		state.name = name
		await updateState()
	}

	const message = messageHook.create({ token: `stream:${id}:message` })
	const joinChannel = joinChannelHook.create({ token: `stream:${id}:join` })

	// Handle both messages and join events
	const events = muxEvents({
		message,
		joinChannel,
	})

	for await (const event of events) {
		if (event.type === "message") {
			state.messages.push({
				content: event.value.content,
				username: event.value.username,
				avatarUrl: event.value.avatarUrl || null,
				timestamp: new Date().toISOString(),
				id: crypto.randomUUID(),
			})
		} else if (event.type === "joinChannel") {
			// Tag this workflow with the joining user's email
			await setTag(`user:${event.value.userEmail}`)
		}

		await updateState()
	}
}
