import { retry } from "ts-retry-promise"
import { OneInchError } from "./services.js"

export function sleep(duration: number) {
	return new Promise(res => setTimeout(res, duration))
}

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

// type RpcReqError =
// 	| EstimateGasExecutionError
// 	| EstimateContractGasErrorType
// 	| GetBalanceErrorType
// 	| WaitForTransactionReceiptErrorType
// 	| ReadContractErrorType
// 	| GetGasPriceErrorType
// 	| SendTransactionErrorType
// 	| WriteContractErrorType
