import { start } from "workflow/api"
import { channelWorkflow } from "@/workflows/channel-workflow"
import crypto from "crypto"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
	const secret = process.env.VERCEL_WEBHOOK_SECRET
	if (!secret) {
		return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 })
	}

	const signature = req.headers.get("x-vercel-signature")
	if (!signature) {
		return NextResponse.json({ error: "Missing signature" }, { status: 400 })
	}

	const rawBody = await req.text()
	const hmac = crypto.createHmac("sha1", secret)
	hmac.update(rawBody)
	const digest = hmac.digest("hex")

	// Use timing-safe comparison to prevent timing attacks
	const signatureBuffer = Buffer.from(signature, "hex")
	const digestBuffer = Buffer.from(digest, "hex")

	if (signatureBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
	}

	// This is idempotent because it's unique based on ID
	void start(channelWorkflow, [
		{
			id: "default",
			name: "public",
			permission: "public",
			creatorEmail: "public",
			isDefault: true,
			initialMessages: [],
		},
	])

	return NextResponse.json({ success: true })
}
