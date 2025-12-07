import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"

interface ChatMessageProps {
	username: string
	avatarUrl: string | null
	content: string
	timestamp: string
}

export function ChatMessage({ username, avatarUrl, content, timestamp }: ChatMessageProps) {
	const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true })

	// Generate initials from username for fallback
	const initials = username
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)

	return (
		<div className="flex gap-3 px-2 py-1.5 hover:bg-muted/50 transition-colors">
			<Avatar className="h-10 w-10 flex-shrink-0">
				<AvatarImage src={avatarUrl || undefined} alt={username} />
				<AvatarFallback>{initials || username[0]?.toUpperCase()}</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				<div className="flex items-baseline gap-2">
					<span className="font-semibold text-sm">{username}</span>
					<span className="text-xs text-muted-foreground">{timeAgo}</span>
				</div>
				<p className="text-sm text-foreground break-words">{content}</p>
			</div>
		</div>
	)
}
