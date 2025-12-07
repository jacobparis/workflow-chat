import type { auth } from "@workflow-chat/auth"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

const getBaseURL = () => {
	if (typeof window !== "undefined") {
		return window.location.origin
	}
	return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000"
}

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	basePath: "/api/auth",
	plugins: [inferAdditionalFields<typeof auth>()],
})
