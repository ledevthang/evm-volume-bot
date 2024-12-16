import { Program } from "./program.js"
import { parseConfig } from "./parse-config.js"
import { privateKeyToAccount } from "viem/accounts"
import { createPublicClient, createWalletClient, fallback, http } from "viem"
import { ERC20 } from "./ecc20.abi.js"

async function main() {
	const config = parseConfig()

	const transport = fallback([http(config.rpc_url)])

	const rpcClient = createPublicClient({
		transport
	})

	const wallet = createWalletClient({
		transport,
		account: privateKeyToAccount(config.private_key)
	})

	const symbol = await rpcClient.readContract({
		abi: ERC20,
		functionName: "symbol",
		address: config.token_address
	})

	const program = new Program(wallet, rpcClient, config, symbol)

	await program.run()
}

main()
