import { isHex } from "viem"
import { z } from "zod"
import type { Config } from "./program"
import { avalanche, mainnet } from "viem/chains"

export function parseConfig() {
	const schema = z.object({
		RPC: z.string().url(),
		PRIVATE_KEY: z.string().refine(isHex, { message: "expected hex string" }),
		CHAIN: z.enum(["ether", "avax"]),
		API_1INCH_KEY: z.string().min(1)
	})

	const { CHAIN, PRIVATE_KEY, RPC } = schema.parse(process.env)

	return {
		config: {
			chain: CHAIN === "avax" ? avalanche : mainnet,
			initFee: 0.01,
			initToken: 0.01,
			subAccountConcurrency: 1,
			subAccountTradingMax: 3,
			tokenAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
		} satisfies Config,
		pk: PRIVATE_KEY,
		rpc: RPC
	}
}
