import { defineHook } from "workflow"
import { createStreamingState } from "@/lib/streaming/server"
import { setTag } from "@/lib/workflow-tags"

export interface Channel {
	id: string
	name: string
	permission: "public" | "private"
	createdAt: string
}

export interface ChannelsState {
	channels: Channel[]
}

export const createChannelHook = defineHook<{
	name: string
	permission: "public" | "private"
	id: string
	createdAt: string
}>()

export async function channelListWorkflow({
	initialChannels = [],
}: {
	initialChannels?: Array<{
		name: string
		permission: "public" | "private"
		id: string
		createdAt: string
	}>
} = {}) {
	"use workflow"

	await setTag("stream:channels", { unique: true })
	await setTag("auth:public")

	const [state, updateState] = createStreamingState<ChannelsState>({
		channels: initialChannels,
	})

	const channelEvents = createChannelHook.create({ token: "stream:channels" })

	for await (const newChannel of channelEvents) {
		if (state.channels.some((c) => c.id === newChannel.id)) {
			// channel already exists, reject silently
			continue
		}

		state.channels.push(newChannel)
		await updateState()
	}
}
