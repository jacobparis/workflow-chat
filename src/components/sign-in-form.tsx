import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import Loader from "./loader"
import { Button } from "./ui/button"

export default function SignInForm() {
	const { isPending } = authClient.useSession()

	const handleSignIn = async () => {
		await authClient.signIn.social(
			{
				provider: "vercel",
			},
			{
				onSuccess: () => {
					toast.success("Sign in successful")
				},
				onError: (error) => {
					toast.error(error.error.message || error.error.statusText)
				},
			},
		)
	}

	if (isPending) {
		return <Loader />
	}

	return (
		<div className="mx-auto w-full mt-10 max-w-md p-6">
			<h1 className="mb-6 text-center text-3xl font-bold">Welcome</h1>
			<p className="mb-6 text-center text-muted-foreground">Sign in with your Vercel account to continue</p>
			<Button onClick={handleSignIn} className="w-full" size="lg">
				Sign in with Vercel
			</Button>
		</div>
	)
}
