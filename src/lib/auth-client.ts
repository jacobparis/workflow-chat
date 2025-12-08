import type { auth } from "@/lib/auth"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

export const authClient = createAuthClient({
	basePath: "/api/auth",
	plugins: [inferAdditionalFields<typeof auth>()],
})
