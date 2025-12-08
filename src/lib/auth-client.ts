import type { auth } from "@/lib/auth"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

console.log("VERCEL_URL", `https://${process.env.VERCEL_DEPLOYMENT_URL}`)
export const authClient = createAuthClient({
	basePath: "/api/auth",
	trustedOrigins: [`https://${process.env.VERCEL_DEPLOYMENT_URL}`],
	plugins: [inferAdditionalFields<typeof auth>()],
})
