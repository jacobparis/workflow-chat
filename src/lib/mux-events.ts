type AsyncIterableValue<T> = T extends AsyncIterable<infer U>
	? U
	: T extends { [Symbol.asyncIterator](): AsyncIterator<infer U> }
	? U
	: never

type MuxedEvent<TMap extends Record<string, AsyncIterable<any>>> = {
	[K in keyof TMap]: {
		type: K
		value: AsyncIterableValue<TMap[K]>
	}
}[keyof TMap]

export async function* muxEvents<TMap extends Record<string, AsyncIterable<any>>>(
	sources: TMap,
): AsyncGenerator<MuxedEvent<TMap>> {
	const iters = {} as {
		[K in keyof TMap]: AsyncIterator<AsyncIterableValue<TMap[K]>>
	}

	for (const key in sources) {
		iters[key] = sources[key][Symbol.asyncIterator]() as any
	}

	type NextResult<K extends keyof TMap> = {
		key: K
		result: IteratorResult<AsyncIterableValue<TMap[K]>>
	}

	const mkNext = <K extends keyof TMap>(key: K) =>
		iters[key].next().then((result) => ({ key, result } as NextResult<K>))

	const nextMap = {} as {
		[K in keyof TMap]: Promise<NextResult<K>>
	}

	for (const key in iters) {
		nextMap[key] = mkNext(key)
	}

	while (true) {
		const pending = Object.values(nextMap) as Promise<NextResult<keyof TMap>>[]

		if (!pending.length) {
			break
		}

		const { key, result } = await Promise.race(pending)

		if (!result.done) {
			yield {
				type: key,
				value: result.value,
			} as MuxedEvent<TMap>
		}

		nextMap[key] = mkNext(key as keyof TMap) as any
	}
}
