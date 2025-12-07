import { start } from "workflow/api"
import { channelWorkflow } from "./workflows/channel-workflow"

export function register() {
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
}
