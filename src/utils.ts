import { retry } from "ts-retry-promise"
import { OneInchError } from "./services.js"

export async function tryToInsufficient<T>(
	thunk: () => Promise<T>
): Promise<T> {
	return retry(thunk, {
		timeout: "INFINITELY",
		retries: "INFINITELY",
		delay: 3_000,
		retryIf: error => {
			console.error(
				`RPC request error: ${JSON.stringify(
					{
						code: error?.code,
						name: error?.name,
						details: error?.details
					},
					null,
					1
				)}`
			)

			return !isInsufficientError(error)
		}
	})
}

export function isInsufficientError(error: any) {
	if (error instanceof OneInchError) {
		error.display()
		return false
	}

	if (error?.details?.includes("gas required exceeds allowance")) return true

	if (error?.details?.includes("insufficient funds")) return true

	return false
}

export function sleep(duration: number) {
	return new Promise(res => setTimeout(res, duration))
}

export function bigintPercent(value: bigint, percent: number) {
	return (value / 100n) * BigInt(percent)
}

// The maximum is inclusive and the minimum is inclusive
export function randomInt(min: number, max: number) {
	const minCeiled = Math.ceil(min)
	const maxFloored = Math.floor(max)
	return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled)
}

// The maximum is inclusive and the minimum is inclusive
export function random(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

// type RpcReqError =
// 	| EstimateGasExecutionError
// 	| EstimateContractGasErrorType
// 	| GetBalanceErrorType
// 	| WaitForTransactionReceiptErrorType
// 	| ReadContractErrorType
// 	| GetGasPriceErrorType
// 	| SendTransactionErrorType
// 	| WriteContractErrorType
