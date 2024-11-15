import axios from "axios"
import type { Address, Transaction } from "web3"

const AXIOS = axios.create({
	baseURL: "https://api.1inch.dev/swap/v6.0/",
	headers: {
		Authorization: `Bearer ${process.env.API_1INCH_KEY}`,
		accept: "application/json"
	}
})

type GenerateApproveParams = {
	chainId: number
	tokenAddress: Address
	amount?: bigint
}

type GenerateApproveResponse = {
	data: string
	gasPrice: string
	to: string
	value: string
}

type GernerateSwapCallDataResponse = {
	tx: Transaction
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

export async function generateApprove({
	amount,
	chainId,
	tokenAddress
}: GenerateApproveParams): Promise<GenerateApproveResponse> {
	const res = await AXIOS.get<GenerateApproveResponse>(
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

export async function generateSwapCallData(
	chainId: number,
	params: SwapParams
): Promise<GernerateSwapCallDataResponse> {
	const resposse = await AXIOS.get(`${chainId}/swap`, {
		params
	})

	return resposse.data
}
