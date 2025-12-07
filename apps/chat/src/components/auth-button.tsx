"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { LogIn, LogOut, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function AuthButton() {
	const router = useRouter()
	const { data: session, isPending } = authClient.useSession()

	if (isPending) {
		return (
			<Button variant="ghost" size="sm" disabled>
				<Loader2 className="h-4 w-4 animate-spin" />
			</Button>
		)
	}

	if (!session) {
		return (
			<Button
				onClick={() => {
					authClient.signIn.social({
						provider: "vercel",
						callbackURL: window.location.pathname,
					})
				}}
				variant="outline"
				size="sm"
			>
				<LogIn className="h-4 w-4 md:mr-2" />
				<span className="hidden md:inline">Sign in</span>
			</Button>
		)
	}

	const user = session.user
	const initials =
		user?.name
			?.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase() ||
		user?.email?.[0]?.toUpperCase() ||
		"U"

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="flex items-center gap-2 cursor-pointer focus:outline-none rounded-md">
					<Avatar className="h-8 w-8 rounded-md">
						{user?.image && <AvatarImage src={user.image || "/placeholder.svg"} alt={user.name || "User"} />}
						<AvatarFallback className="rounded-md">{initials}</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>
					<div className="flex flex-col gap-0.5">
						<p className="text-sm font-medium leading-none">{user?.name || user?.email || "User"}</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									router.push("/")
								},
							},
						})
					}}
					className="cursor-pointer"
				>
					<LogOut className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
