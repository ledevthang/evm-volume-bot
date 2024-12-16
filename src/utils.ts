import { retry } from "ts-retry-promise"
import { isAxiosError } from "axios"
import { Logger } from "./logger.js"

export async function tryToInsufficient<T>(
	thunk: () => Promise<T>
): Promise<T> {
	return retry(thunk, {
		timeout: "INFINITELY",
		retries: "INFINITELY",
		delay: 3_000,
		retryIf: error => {
			if (isAxiosError(error))
				Logger.error(
					`Http request error: ${JSON.stringify(
						{
							code: error.code,
							message: error.message,
							response: error.response?.data
						},
						null,
						1
					)}`
				)
			else if (error.details) {
				Logger.error(
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
			} else Logger.error(error)

			return !isInsufficientError(error)
		}
	})
}

function isInsufficientError(error: any) {
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

// The maximum is exclusive and the minimum is inclusive
export function random(min: number, max: number) {
	return Math.random() * (max - min) + min
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
