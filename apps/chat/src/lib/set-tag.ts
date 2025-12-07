import { getWorkflowMetadata } from "workflow"
import { getRun } from "workflow/api"
import { redis } from "./redis"

export const REDIS_PREFIX = "workflow-utils"

// Function overloads
export async function setTag(tag: string, value: string, options?: { unique?: boolean }): Promise<void>
export async function setTag(tag: string, options?: { unique?: boolean }): Promise<void>
export async function setTag(
	tag: string,
	valueOrOptions?: string | { unique?: boolean },
	options?: { unique?: boolean },
): Promise<void> {
	"use step"
	const { workflowRunId } = getWorkflowMetadata()
	const listKey = `${REDIS_PREFIX}tag:${tag}`

	// Handle overloaded signature: setTag(tag, value, options?) or setTag(tag, options?)
	let tagValue: string | undefined
	let unique: boolean | undefined

	if (typeof valueOrOptions === "string") {
		tagValue = valueOrOptions
		unique = options?.unique
	} else {
		unique = valueOrOptions?.unique ?? options?.unique
	}

	if (unique) {
		const existingRuns = await redis.lrange<string>(listKey, 0, -1)

		const orphanedRuns = [] as string[]
		if (existingRuns && existingRuns.length > 0) {
			// Check if any of the existing runs are still active
			for (const runId of existingRuns) {
				try {
					const run = getRun(runId)
					const status = await run.status

					console.log("run", run)
					console.log("status", status)

					if (!run || status === "failed" || status === "completed") {
						orphanedRuns.push(runId)
						continue
					}

					throw new Error(
						`Tag "${tag}" is already set by another workflow run. Only one run can have this tag when unique: true.`,
					)
				} catch (error) {
					// If getRun throws or run doesn't exist, continue checking other runs
					continue
				}
			}
		}
		if (orphanedRuns.length > 0) {
			await redis.lrem(listKey, 0, orphanedRuns)
			// Also remove orphaned values
			const valuesKey = `${listKey}:values`
			for (const runId of orphanedRuns) {
				await redis.hdel(valuesKey, runId)
			}
		}
	}

	console.log(`tagging ${workflowRunId} with ${tag}${tagValue ? ` (value: ${tagValue})` : ""}`)
	await redis.rpush(listKey, workflowRunId)

	// Store the value if provided
	if (tagValue !== undefined) {
		const valuesKey = `${listKey}:values`
		await redis.hset(valuesKey, { [workflowRunId]: tagValue })
	}
}
