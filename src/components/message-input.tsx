"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"

interface MessageInputProps {
	onSend: (content: string) => void
	disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
	const [message, setMessage] = useState("")

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (message.trim() && !disabled) {
			onSend(message.trim())
			setMessage("")
		}
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setMessage(e.target.value)
	}

	return (
		<form onSubmit={handleSubmit} className="border-t border-border p-4">
			<div className="flex gap-2">
				<Input
					value={message}
					onChange={handleChange}
					placeholder="Type a message..."
					disabled={disabled}
					className="flex-1"
				/>
				<Button type="submit" size="icon" disabled={disabled || !message.trim()}>
					<Send className="h-4 w-4" />
				</Button>
			</div>
		</form>
	)
}
