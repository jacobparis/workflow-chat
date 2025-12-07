import { redis } from "@/lib/redis"
import { REDIS_PREFIX } from "@/lib/workflow-tags"

export async function getTagForRun(runId: string, tag: string): Promise<string | null> {
	const valuesKey = `${REDIS_PREFIX}tag:${tag}:values`
	return await redis.hget<string>(valuesKey, runId)
}
