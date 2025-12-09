import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Suspense } from "react"
import "../index.css"
import Providers from "@/components/providers"
import { StreamStateProvider } from "@/lib/workflow-utils/stream-state/react"
import { ChatHeader } from "@/components/chat-header"
import { ErrorBoundary } from "@/components/error-boundary"
import { getUserChannels } from "@/lib/channel/get-user-channels"

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
})

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
})

export const metadata: Metadata = {
	title: "Workflow Chat",
	description: "Real-time chat application powered by workflows",
	keywords: ["chat", "workflow", "real-time", "messaging"],
	authors: [{ name: "Workflow Chat" }],
	creator: "Workflow Chat",
	publisher: "Workflow Chat",
	alternates: {
		canonical: "/",
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		title: "Workflow Chat",
		description: "Real-time chat application powered by workflows",
		siteName: "Workflow Chat",
	},
	twitter: {
		card: "summary",
		title: "Workflow Chat",
		description: "Real-time chat application powered by workflows",
	},
	robots: {
		index: true,
		follow: true,
	},
}

export const viewport = {
	themeColor: "#000000",
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	// Get channels the user has access to (tagged with their email)
	const initialChannels = await getUserChannels()

	return (
		<html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
			<body className="font-mono antialiased flex flex-col min-h-screen">
				<StreamStateProvider>
					<ErrorBoundary>
						<Providers>
							<div className="flex flex-col min-h-screen md:items-center md:justify-center md:p-4">
								<div className="flex flex-col w-full h-screen md:h-auto md:max-w-6xl md:min-h-[600px] md:max-h-[90vh] md:rounded-lg md:shadow-2xl md:border md:border-border bg-background overflow-hidden">
									<ChatHeader initialChannels={initialChannels} />
									<div className="flex-1 min-h-0 overflow-hidden">
										<Suspense fallback={null}>{children}</Suspense>
									</div>
								</div>
							</div>
						</Providers>
					</ErrorBoundary>
				</StreamStateProvider>
			</body>
		</html>
	)
}
