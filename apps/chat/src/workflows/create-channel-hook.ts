"use server"

import { auth } from "@workflow-chat/auth"
import { headers } from "next/headers"
import { channelListWorkflow, createChannelHook } from "./channel-list-workflow"
import { start } from "workflow/api"
import { channelWorkflow } from "./channel-workflow"

export async function createChannel({
	name,
	permission,
	isDefault = false,
}: {
	name: string
	permission: "public" | "private"
	isDefault?: boolean
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user?.email) {
		throw new Error("Unauthorized")
	}

	if (permission !== "public" && permission !== "private") {
		throw new Error("Invalid permission")
	}

	const isAdmin = session.user.email === "jacob.paris@vercel.com"

	if (permission === "public" && !isAdmin) {
		// lazy admin check
		throw new Error("Unauthorized")
	}

	if (isDefault && !isAdmin) {
		// Only admins can create default channels
		throw new Error("Unauthorized")
	}

	name = name.replace(/[^a-zA-Z0-9]/g, "")

	const channelId = crypto.randomUUID()
	const newChannel = {
		id: channelId,
		name,
		permission,
		creatorEmail: session.user.email,
		isDefault,
		createdAt: new Date().toISOString(),
		initialMessages: [],
	}

	await start(channelWorkflow, [newChannel])

	try {
		await createChannelHook.resume("stream:channels", newChannel)
	} catch (error) {
		await start(channelListWorkflow, [{ initialChannels: [newChannel] }])
	}

	return channelId
}
