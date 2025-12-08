export type StreamMsg<T = any> = { type: "replace"; state: T } | { type: "patch"; patch: unknown[] }

export type NamespacedStreamMsg<T = any> = StreamMsg<T> & {
	namespace: string
	workflowId: string
}
