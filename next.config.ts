import type { NextConfig } from "next"
import { withWorkflow } from "workflow/next"

export default withWorkflow({
	typedRoutes: true,
	reactCompiler: true,
} satisfies NextConfig)
