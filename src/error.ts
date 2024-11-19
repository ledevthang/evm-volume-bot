import type { AxiosError } from "axios"
import type { Effect } from "effect"

export type Result<A, E> = Effect.Effect<A, E, never>

export function isInsufficient(error: unknown): error is InsufficientError {
	return true
}

export class OneInchError {
	public readonly _tag = "OneInchError"
	constructor(private error: AxiosError) {}
}

export class RpcReadError {
	public readonly _tag = "RpcReadError"
	constructor(private error: unknown) {}
}

export class RpcSendError {
	public readonly _tag = "RpcSendError"
	constructor(private error: unknown) {}
}

export class RpcWriteContractError {
	public readonly _tag = "RpcWriteContractError"
	constructor(private error: unknown) {}
}

export class InsufficientError {
	public readonly _tag = "RpcSendError"

	constructor(private message: string) {}
}

export class WaitTxReceiptError {
	public readonly _tag = "WaitTxReceiptError"

	constructor(private error: unknown) {}
}

export class FsError {
	public readonly _tag = "FsError"
	constructor(private error: unknown) {}
}

export class UnknownError {
	public readonly _tag = "UnknownError"

	constructor(private error: unknown) {}
}
