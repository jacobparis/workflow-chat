/**
 * Redis-like interface for tag operations
 * This allows the tag system to work with any Redis-compatible client
 */
export interface RedisLike {
	lrange<T = string>(key: string, start: number, end: number): Promise<T[]>
	lrem(key: string, count: number, ...values: string[]): Promise<number>
	rpush(key: string, ...values: string[]): Promise<number>
	hset(key: string, obj: Record<string, string>): Promise<number>
	hdel(key: string, ...fields: string[]): Promise<number>
	hget<T = string>(key: string, field: string): Promise<T | null>
	keys(pattern: string): Promise<string[]>
}

/**
 * Tag client that manages workflow tags using a Redis-like interface
 */
export function createTagClient(redis: RedisLike, prefix: string = "workflow-utils") {
	/**
	 * Get the full key for a tag list
	 */
	function getTagListKey(tag: string): string {
		return `${prefix}tag:${tag}`
	}

	/**
	 * Get the full key for tag values hash
	 */
	function getTagValuesKey(tag: string): string {
		return `${getTagListKey(tag)}:values`
	}

	/**
	 * Internal helper to get runs for a single tag from Redis
	 */
	async function getRunsForTag(tag: string): Promise<string[]> {
		const listKey = getTagListKey(tag)
		return await redis.lrange<string>(listKey, 0, -1)
	}

	/**
	 * Add a run ID to a tag list
	 */
	async function addRunToTag(tag: string, runId: string): Promise<void> {
		const listKey = getTagListKey(tag)
		await redis.rpush(listKey, runId)
	}

	/**
	 * Remove run IDs from a tag list
	 */
	async function removeRunsFromTag(tag: string, runIds: string[]): Promise<void> {
		if (runIds.length === 0) return
		const listKey = getTagListKey(tag)
		await redis.lrem(listKey, 0, ...runIds)
	}

	/**
	 * Set a tag value for a run
	 */
	async function setTagValue(tag: string, runId: string, value: string): Promise<void> {
		const valuesKey = getTagValuesKey(tag)
		await redis.hset(valuesKey, { [runId]: value })
	}

	/**
	 * Remove tag values for runs
	 */
	async function removeTagValues(tag: string, runIds: string[]): Promise<void> {
		if (runIds.length === 0) return
		const valuesKey = getTagValuesKey(tag)
		await redis.hdel(valuesKey, ...runIds)
	}

	/**
	 * List runs by tag(s) with optional OR and NOT filters
	 *
	 * @param tag - Single tag or array of tags (intersection - runs must have ALL tags)
	 * @param options - Optional filters
	 * @param options.OR - Tags where runs must have at least one (union)
	 * @param options.NOT - Tags to exclude runs that have any of these
	 * @returns Array of run IDs matching the criteria
	 */
	async function listRunsByTag(
		tag: string | string[],
		options?: {
			OR?: string | Array<string | undefined>
			NOT?: string | Array<string | undefined>
		},
	): Promise<string[]> {
		const tags = Array.isArray(tag) ? tag : [tag]

		if (tags.length === 0) {
			return []
		}

		// Get all runs for each required tag
		const allRuns = await Promise.all(tags.map(async (t) => await getRunsForTag(t)))

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
			const validOrTags = orTags.filter((t): t is string => Boolean(t))
			if (validOrTags.length > 0) {
				const orRuns = await Promise.all(validOrTags.map(async (t) => await getRunsForTag(t)))
				const orSet = new Set(orRuns.flat())
				result = result.filter((runId) => orSet.has(runId))
			}
		}

		// Apply NOT filter: runs must NOT have any of the NOT tags
		if (options?.NOT) {
			const notTags = Array.isArray(options.NOT) ? options.NOT : [options.NOT]
			const validNotTags = notTags.filter((t): t is string => Boolean(t))
			if (validNotTags.length > 0) {
				const notRuns = await Promise.all(validNotTags.map(async (t) => await getRunsForTag(t)))
				const notSet = new Set(notRuns.flat())
				result = result.filter((runId) => !notSet.has(runId))
			}
		}

		return result
	}

	/**
	 * Set a tag for a specific run ID
	 * This function contains the tag setting logic that can be reused
	 */
	async function setTagForRun(
		runId: string,
		tag: string,
		value?: string,
		options?: { unique?: boolean },
	): Promise<void> {
		if (options?.unique) {
			const existingRuns = await listRunsByTag(tag)

			const orphanedRuns = [] as string[]
			if (existingRuns && existingRuns.length > 0) {
				// Dynamic import to avoid circular dependency
				const { getRun } = await import("workflow/api")
				// Check if any of the existing runs are still active
				for (const existingRunId of existingRuns) {
					try {
						const run = getRun(existingRunId)
						const status = await run.status

						if (!run || status === "failed" || status === "completed") {
							orphanedRuns.push(existingRunId)
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
				await removeRunsFromTag(tag, orphanedRuns)
				await removeTagValues(tag, orphanedRuns)
			}
		}

		await addRunToTag(tag, runId)

		// Store the value if provided
		if (value !== undefined) {
			await setTagValue(tag, runId, value)
		}
	}

	return {
		/**
		 * Get all keys matching a pattern
		 * Pattern should not include the prefix - it will be added automatically
		 */
		async getKeys(pattern: string): Promise<string[]> {
			return await redis.keys(`${prefix}${pattern}`)
		},

		/**
		 * List runs by tag(s) with optional OR and NOT filters
		 *
		 * @param tag - Single tag or array of tags (intersection - runs must have ALL tags)
		 * @param options - Optional filters
		 * @param options.OR - Tags where runs must have at least one (union)
		 * @param options.NOT - Tags to exclude runs that have any of these
		 * @returns Array of run IDs matching the criteria
		 */
		listRunsByTag,

		/**
		 * Get a tag value for a run
		 */
		async getTag(runId: string, tag: string): Promise<string | null> {
			const valuesKey = getTagValuesKey(tag)
			return await redis.hget<string>(valuesKey, runId)
		},

		/**
		 * Set a tag for a specific run ID
		 * This method contains the tag setting logic that can be reused
		 * Called by workflow setTag functions
		 */
		setTagForRun,
	}
}
