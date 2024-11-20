import { isAddress, isHex } from "viem"
import { z } from "zod"
import type { Config } from "./program.js"
import { avalanche, mainnet } from "viem/chains"

export function parseConfig() {
	const schema = z.object({
		RPC_1: z.string().url(),
		RPC_2: z.string().url(),
		PRIVATE_KEY: z.string().refine(isHex, { message: "expected hex string" }),
		CHAIN: z.enum(["ether", "avax"]),
		API_1INCH_KEY: z.string().min(1),
		INIT_FEE: z.string().transform(Number).pipe(z.number()),
		INIT_TOKEN: z.string().transform(Number).pipe(z.number()),
		SUB_ACCOUNT_CONCURRENCY: z
			.string()
			.transform(Number)
			.pipe(z.number().int().min(1)),
		SUB_ACCOUNT_TRADING_MAX: z
			.string()
			.transform(Number)
			.pipe(z.number().int().min(1)),
		TOKEN_ADDRESS: z
			.string()
			.refine(isAddress, { message: "invalid token address" })
	})

	const {
		CHAIN,
		PRIVATE_KEY,
		RPC_1,
		RPC_2,
		INIT_FEE,
		INIT_TOKEN,
		SUB_ACCOUNT_CONCURRENCY,
		SUB_ACCOUNT_TRADING_MAX,
		TOKEN_ADDRESS
	} = schema.parse(process.env)

	return {
		pk: PRIVATE_KEY,
		rpc1: RPC_1,
		rpc2: RPC_2,
		config: {
			chain: CHAIN === "avax" ? avalanche : mainnet,
			initFee: INIT_FEE,
			initToken: INIT_TOKEN,
			subAccountConcurrency: SUB_ACCOUNT_CONCURRENCY,
			subAccountTradingMax: SUB_ACCOUNT_TRADING_MAX,
			tokenAddress: TOKEN_ADDRESS
		} satisfies Config
	}
}
