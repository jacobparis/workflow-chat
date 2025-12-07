import { redis } from "./redis"
import { createTagClient } from "./workflow-utils/tags"

const tag = createTagClient(redis)

export default tag
