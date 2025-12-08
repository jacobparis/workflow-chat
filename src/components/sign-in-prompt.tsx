"use client"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function SignInPrompt() {
	const { isPending } = authClient.useSession()

	const handleSignIn = () => {
		authClient.signIn.social({
			provider: "vercel",
			callbackURL: window.location.pathname,
		})
	}

	return (
		<div className="border-t border-border p-4 bg-muted/50">
			<div className="max-w-md mx-auto text-center space-y-3">
				<p className="text-sm text-muted-foreground">Sign in to send messages and join the conversation</p>
				<Button onClick={handleSignIn} disabled={isPending} size="sm">
					{isPending ? "Signing in..." : "Sign in with Vercel"}
				</Button>
			</div>
		</div>
	)
}
