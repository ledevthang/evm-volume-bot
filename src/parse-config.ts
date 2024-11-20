import { isHex } from "viem"
import { z } from "zod"
import type { Config } from "./program.js"
import { avalanche, mainnet } from "viem/chains"

export function parseConfig() {
	const schema = z.object({
		RPC_1: z.string().url(),
		RPC_2: z.string().url(),
		PRIVATE_KEY: z.string().refine(isHex, { message: "expected hex string" }),
		CHAIN: z.enum(["ether", "avax"]),
		API_1INCH_KEY: z.string().min(1)
	})

	const { CHAIN, PRIVATE_KEY, RPC_1,RPC_2 } = schema.parse(process.env)

	return {
		pk: PRIVATE_KEY,
		rpc1: RPC_1,
		rpc2: RPC_2,
		config: {
			chain: CHAIN === "avax" ? avalanche : mainnet,
			initFee: 0.1,
			initToken: 0.05,
			subAccountConcurrency: 1,
			subAccountTradingMax: 6,
			tokenAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
		} satisfies Config
	}
}
