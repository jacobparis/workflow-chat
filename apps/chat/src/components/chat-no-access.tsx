"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function ChatNoAccess() {
	return (
		<div className="flex flex-col h-screen bg-background">
			<div className="flex-1 overflow-y-auto p-4">
				<div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 text-center">
					<div className="space-y-2">
						<p className="text-lg font-medium">Channel not found</p>
						<p className="text-sm">This channel may not exist, or it may be private and you don't have access to it.</p>
					</div>
					<Button asChild variant="outline">
						<Link href="/">Go to Home</Link>
					</Button>
				</div>
			</div>
		</div>
	)
}
