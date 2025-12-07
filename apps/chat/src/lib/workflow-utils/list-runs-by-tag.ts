import { redis } from "../redis"
import { REDIS_PREFIX } from "../workflow-tags"

interface FilterOptions {
	OR?: string | Array<string | undefined>
	NOT?: string | Array<string | undefined>
}

export async function listRunsByTag(tag: string | string[], options?: FilterOptions): Promise<string[]> {
	const tags = Array.isArray(tag) ? tag : [tag]

	if (tags.length === 0) {
		return []
	}

	// Get all runs for each required tag
	const allRuns = await Promise.all(
		tags.map(async (t) => {
			const listKey = `${REDIS_PREFIX}tag:${t}`
			return await redis.lrange<string>(listKey, 0, -1)
		}),
	)

	// Find intersection - runs that appear in all required tag lists
	// Start with the first list
	let intersection = new Set(allRuns[0] || [])

	// Intersect with each subsequent list
	for (let i = 1; i < allRuns.length; i++) {
		const currentSet = new Set(allRuns[i] || [])
		intersection = new Set([...intersection].filter((runId) => currentSet.has(runId)))
	}

	let result = Array.from(intersection)

	// Apply OR filter: runs must have at least one of the OR tags
	if (options?.OR) {
		const orTags = Array.isArray(options.OR) ? options.OR : [options.OR]
		const validOrTags = orTags.filter(Boolean)
		if (validOrTags.length > 0) {
			const orRuns = await Promise.all(
				validOrTags.map(async (t) => {
					const listKey = `${REDIS_PREFIX}tag:${t}`
					return await redis.lrange<string>(listKey, 0, -1)
				}),
			)
			const orSet = new Set(orRuns.flat())
			result = result.filter((runId) => orSet.has(runId))
		}
	}

	// Apply NOT filter: runs must NOT have any of the NOT tags
	if (options?.NOT) {
		const notTags = Array.isArray(options.NOT) ? options.NOT : [options.NOT]
		const notRuns = await Promise.all(
			notTags.filter(Boolean).map(async (t) => {
				const listKey = `${REDIS_PREFIX}tag:${t}`
				return await redis.lrange<string>(listKey, 0, -1)
			}),
		)
		const notSet = new Set(notRuns.flat())
		result = result.filter((runId) => !notSet.has(runId))
	}

	return result
}
