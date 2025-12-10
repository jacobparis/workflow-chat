import type { NextConfig } from "next"
import { withWorkflow } from "workflow/next"
import { withMicrofrontends } from "@vercel/microfrontends/next/config"

export default withWorkflow(
	withMicrofrontends({
		typedRoutes: true,
		reactCompiler: true,
	} satisfies NextConfig),
)
