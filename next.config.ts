import type { NextConfig } from "next"
import path from "node:path"
import { withWorkflow } from "workflow/next"

export default withWorkflow({
	typedRoutes: true,
	reactCompiler: true,
	outputFileTracingRoot: path.join(__dirname, "../../"),
} satisfies NextConfig)
