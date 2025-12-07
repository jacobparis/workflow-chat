"use client"

import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Hash, Plus } from "lucide-react"
import { AuthButton } from "./auth-button"
import { authClient } from "@/lib/auth-client"
import { createChannel } from "@/workflows/create-channel-hook"
import { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ChatHeader({
	initialChannels,
}: {
	initialChannels: Array<{
		id: string
		name: string
	}>
}) {
	const router = useRouter()
	const pathname = usePathname()
	const { data: session } = authClient.useSession()
	const [isCreating, setIsCreating] = useState(false)
	const [open, setOpen] = useState(false)
	const [channelName, setChannelName] = useState("")
	const [permission, setPermission] = useState<"public" | "private">("private")

	const isAuthenticated = !!session
	const userEmail = session?.user?.email
	const canCreatePublic = userEmail === "jacob.paris@vercel.com"

	// TODO: Add real-time channel list updates if needed
	const channels = initialChannels

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen)
		if (newOpen && !canCreatePublic) {
			setPermission("private")
		}
	}

	// Extract current channel ID from pathname (e.g., /channels/public -> public)
	const currentChannelId = pathname?.startsWith("/channels/")
		? pathname.split("/channels/")[1]?.split("/")[0] || ""
		: ""

	const handleChannelClick = (channelId: string) => {
		router.push(`/channels/${channelId}`)
	}

	const handleCreateChannel = async (e: React.FormEvent) => {
		e.preventDefault()
		if (isCreating || !channelName.trim()) return

		setIsCreating(true)
		try {
			const channelId = await createChannel({ name: channelName.trim(), permission })
			setChannelName("")
			setPermission("private")
			setOpen(false)
			// Redirect to the new channel
			router.replace(`/channels/${channelId}`)
		} catch (error) {
			console.error("Failed to create channel:", error)
			alert("Failed to create channel")
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<div className="border-b border-border px-4 py-2 flex items-center justify-between">
			<div className="flex items-center gap-1">
				{channels.map((channel) => (
					<button
						key={channel.id}
						onClick={() => handleChannelClick(channel.id)}
						className={cn(
							"flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors",
							currentChannelId === channel.id
								? "bg-background text-foreground border-b-2 border-foreground"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
						)}
					>
						<Hash className="h-3.5 w-3.5" />
						<span>{channel.name}</span>
					</button>
				))}
				{isAuthenticated && (
					<Dialog open={open} onOpenChange={handleOpenChange}>
						<DialogTrigger asChild>
							<button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50">
								<Plus className="h-3.5 w-3.5" />
								<span>New</span>
							</button>
						</DialogTrigger>
						<DialogContent>
							<form onSubmit={handleCreateChannel}>
								<DialogHeader>
									<DialogTitle>Create Channel</DialogTitle>
									<DialogDescription>Create a new channel for your team to chat in.</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									<div className="grid gap-2">
										<label htmlFor="name" className="text-sm font-medium">
											Channel Name
										</label>
										<Input
											id="name"
											value={channelName}
											onChange={(e) => setChannelName(e.target.value)}
											placeholder="general"
											required
										/>
									</div>
									<div className="grid gap-2">
										<label className="text-sm font-medium">Permission</label>
										<div className="grid gap-2">
											<label
												className={cn(
													"flex items-center gap-2",
													canCreatePublic ? "cursor-pointer" : "cursor-not-allowed opacity-50",
												)}
											>
												<input
													type="radio"
													name="permission"
													value="public"
													checked={permission === "public"}
													onChange={() => setPermission("public")}
													disabled={!canCreatePublic}
													className="h-4 w-4"
												/>
												<div>
													<div className="text-sm font-medium">Public</div>
													<div className="text-xs text-muted-foreground">Anyone can read</div>
												</div>
											</label>
											<label className="flex items-center gap-2 cursor-pointer">
												<input
													type="radio"
													name="permission"
													value="private"
													checked={permission === "private"}
													onChange={() => setPermission("private")}
													className="h-4 w-4"
												/>
												<div>
													<div className="text-sm font-medium">Private</div>
													<div className="text-xs text-muted-foreground">Logged in users only</div>
												</div>
											</label>
										</div>
									</div>
								</div>
								<DialogFooter>
									<Button type="button" variant="outline" onClick={() => setOpen(false)}>
										Cancel
									</Button>
									<Button type="submit" disabled={isCreating || !channelName.trim()}>
										{isCreating ? "Creating..." : "Create Channel"}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				)}
			</div>
			<AuthButton />
		</div>
	)
}
