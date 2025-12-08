import { nextCookies } from "better-auth/next-js"
import { betterAuth } from "better-auth"

export const auth = betterAuth({
	basePath: "/api/auth",
	trustedOrigins: [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`, "http://localhost:3000"],
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 7 * 24 * 60 * 60, // 7 days cache duration
			strategy: "jwe", // can be "jwt" or "compact"
			refreshCache: true, // Enable stateless refresh
		},
	},
	account: {
		storeStateStrategy: "cookie",
		storeAccountCookie: true, // Store account data after OAuth flow in a cookie (useful for database-less flows)
	},
	socialProviders: {
		vercel: {
			clientId: process.env.VERCEL_CLIENT_ID as string,
			clientSecret: process.env.VERCEL_CLIENT_SECRET as string,
		},
	},
	plugins: [nextCookies()],
})
