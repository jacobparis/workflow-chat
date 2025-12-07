import { redis } from "./redis"
import { createTagClient } from "./workflow-utils/tags"

export const TAG_PREFIX = "workflow-v3"

const tag = createTagClient(redis, TAG_PREFIX)

export default tag
