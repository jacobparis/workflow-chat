"use server"

import { auth } from "@workflow-chat/auth"
import { headers } from "next/headers"
import { start } from "workflow/api"
import { channelWorkflow } from "./channel-workflow"

export async function createChannel({ name, permission }: { name: string; permission: "public" | "private" }) {
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

	name = name.replace(/[^a-zA-Z0-9]/g, "")

	const channelId = crypto.randomUUID()
	const newChannel = {
		id: channelId,
		name,
		permission,
		creatorEmail: session.user.email,
		isDefault: false,
		createdAt: new Date().toISOString(),
		initialMessages: [],
	}

	await start(channelWorkflow, [newChannel])

	return channelId
}
