import axios, { isAxiosError } from "axios"
import type { Address, Hex } from "viem"
import { sleep } from "./sleep.js"
import { DateTime } from "luxon"
import { OneInchError, type Result, UnknownError } from "./error.js"
import { Duration, Effect, pipe, Schedule } from "effect"

type GenerateApproveParams = {
	chainId: number
	tokenAddress: Address
	amount?: bigint
}

type GenerateApproveResponse = {
	data: Hex
	gasPrice: string
	to: Address
	value: string
}

type GernerateSwapCallDataResponse = {
	dstAmount: string
	tx: {
		from: Address
		to: Address
		data: Hex
		value: string
		gasPrice: string
		gas: number
	}
}

export type SwapParams = {
	src: Address // Token address of AVAX
	dst: Address // Token address of WAVAX
	amount: string // Amount of AVAX to swap (in wei)
	from: Address
	slippage: number // Maximum acceptable slippage percentage for the swap (e.g., 1 for 1%)
	disableEstimate?: boolean // Set to true to disable estimation of swap details
	allowPartialFill?: boolean // Set to true to allow partial filling of the swap order
}

export class OneInch {
	private AXIOS = axios.create({
		baseURL: "https://api.1inch.dev/swap/v6.0/",
		headers: {
			Authorization: `Bearer ${process.env.API_1INCH_KEY}`,
			accept: "application/json"
		}
	})

	private lastimeCalling = DateTime.now()
	private restTimeInMiliSeconds = 3000

	generateApprove(
		params: GenerateApproveParams
	): Result<GenerateApproveResponse, OneInchError | UnknownError> {
		return this.handle429AndRetry(() => this.unsafeGenerateApprove(params))
	}

	generateSwapCallData(
		chainId: number,
		params: SwapParams
	): Result<GernerateSwapCallDataResponse, OneInchError | UnknownError> {
		return this.handle429AndRetry(() =>
			this.unsafeGenerateSwapCallData(chainId, params)
		)
	}

	spotPrice<T extends Address>(
		chainId: number,
		address: T[]
	): Result<Record<T, string>, OneInchError | UnknownError> {
		return this.handle429AndRetry(() => this.unsafeSpotPrice(chainId, address))
	}

	private async unsafeGenerateApprove({
		amount,
		chainId,
		tokenAddress
	}: GenerateApproveParams): Promise<GenerateApproveResponse> {
		const res = await this.AXIOS.get<GenerateApproveResponse>(
			`${chainId}/approve/transaction`,
			{
				params: {
					tokenAddress,
					amount
				}
			}
		)

		return res.data
	}

	private async unsafeGenerateSwapCallData(
		chainId: number,
		params: SwapParams
	) {
		const response = await this.AXIOS.get(`${chainId}/swap`, {
			params
		})

		return response.data
	}

	private async unsafeSpotPrice<T extends Address>(
		chainId: number,
		address: T[]
	) {
		const response = await this.AXIOS.get<Record<T, string>>(
			`https://api.1inch.dev/price/v1.1/${chainId}/${address}?currency=USD`
		)

		return response.data
	}

	private handle429AndRetry<T>(
		thunk: () => Promise<T>
	): Result<T, OneInchError | UnknownError> {
		return pipe(
			Effect.tryPromise({
				try: async () => {
					while (
						DateTime.now().toSeconds() - this.lastimeCalling.toSeconds() >
						this.restTimeInMiliSeconds
					) {
						await sleep(1000)
					}

					return thunk()
				},
				catch: error => {
					if (isAxiosError(error)) return new OneInchError(error)
					return new UnknownError(error)
				}
			}),
			Effect.tap(() => {
				Effect.sleep(Duration.millis(this.restTimeInMiliSeconds))
			}),
			Effect.retry({ times: 6, schedule: Schedule.fixed("1500 millis") })
		)
	}
}
