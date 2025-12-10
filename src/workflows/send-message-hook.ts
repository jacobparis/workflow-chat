"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { messageHook } from "./channel-workflow"
import { TAG_PREFIX } from "@/lib/tag"

export async function sendMessage({ content, channelId }: { content: string; channelId: string }) {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user?.email) {
		throw new Error("Unauthorized")
	}

	const username = session.user.name || session.user.email
	const avatarUrl = session.user.image || null

	const initialMessage = {
		content,
		username,
		avatarUrl,
	}

	try {
		await messageHook.resume(`stream:${channelId}:message`, initialMessage)
	} catch (error) {
		throw new Error(`Channel ${channelId} not found`)
	}
}
