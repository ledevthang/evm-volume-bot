import { z } from "zod"
import { evmAddress, notEmptyStr, positiveNumber } from "./parsers.js"
import fs from "node:fs"
import { avalanche, mainnet } from "viem/chains"
import { isHex } from "viem"
import path from "node:path"

export type Config = z.infer<typeof schema>

const processDir = process.cwd()

export const encryptedFilePath = path.resolve(processDir, "evm-wallets.txt")

export const decryptedFilePath = path.resolve(
	processDir,
	"evm-decoded-wallets.txt"
)

const schema = z.object({
	private_key: notEmptyStr().refine(isHex, "expected a hex string"),
	chain: z
		.enum(["ether", "avax"])
		.optional()
		.default("ether")
		.transform(chain => (chain === "avax" ? avalanche : mainnet)),
	rpc_url: z.string().url(),
	one_inch_api_key: notEmptyStr(),

	token_address: evmAddress(),

	slippage: positiveNumber(),

	consecutive_buys: z.number().int().min(0),
	consecutive_sells: z.number().int().min(0),

	wait_time_min: positiveNumber(), // in seconds
	wait_time_max: positiveNumber(), // in seconds

	min_eth: positiveNumber(),
	max_eth: positiveNumber(),
	start_with_buy: z.boolean()
})

export function parseConfig() {
	const configFilePath = path
		.resolve(import.meta.dirname, "config.json")
		.replace("/dist", "")

	const config = schema.parse(
		JSON.parse(fs.readFileSync(configFilePath, "utf-8"))
	)
	return config
}
