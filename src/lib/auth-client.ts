import type { auth } from "@/lib/auth"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

export const authClient = createAuthClient({
	basePath: "/api/auth",
	trustedOrigins: [`https://${process.env.VERCEL_URL}`],
	plugins: [inferAdditionalFields<typeof auth>()],
})
