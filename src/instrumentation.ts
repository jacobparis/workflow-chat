import { start } from "workflow/api"

export async function register() {
	if (process.env.NODE_ENV === "development") {
		const { channelWorkflow } = await import("./workflows/channel-workflow")
		start(channelWorkflow, [
			{
				id: "default",
				name: "public",
				permission: "public",
				creatorEmail: "public",
				isDefault: true,
				initialMessages: [],
			},
		])
	}
}
