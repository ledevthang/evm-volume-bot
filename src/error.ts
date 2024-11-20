import type { AxiosError } from "axios"
import type { Effect } from "effect"
import type { RpcRequestError as ViemRpcRequestError } from "viem"

export type Result<A, E> = Effect.Effect<A, E, never>

type BotError = {
	readonly _tag: string
	display(): Record<string, unknown>
}

export class OneInchError implements BotError {
	public readonly _tag = "OneInchError"
	constructor(private error: AxiosError) {}

	public display() {
		return {
			message: this.error.message,
			reponse: {
				code: this.error.code,
				data: this.error.response?.data,
				status: this.error.response?.status
			}
		}
	}
}
export class RpcRequestError implements BotError {
	public readonly _tag = "RpcReadError"
	constructor(private error: unknown) {}

	public display() {
		const error = this.error as ViemRpcRequestError
		return {
			code: error.code,
			name: error.name,
			details: error.details,
			shortMessage: error.shortMessage
		}
	}
}

export class FsError implements BotError {
	public readonly _tag = "FsError"
	constructor(private error: unknown) {}

	public display() {
		return {
			message:
				this.error instanceof Error ? this.error.message : String(this.error)
		}
	}
}

export class UnknownError implements BotError {
	public readonly _tag = "UnknownError"

	constructor(private error: unknown) {}

	public display() {
		return {
			message:
				this.error instanceof Error ? this.error.message : String(this.error)
		}
	}
}
