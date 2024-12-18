import { Program } from "./program.js"
import { parseConfig } from "./parse-config.js"
import { privateKeyToAccount } from "viem/accounts"
import {
	createPublicClient,
	createWalletClient,
	erc20Abi,
	fallback,
	http
} from "viem"

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
		abi: erc20Abi,
		functionName: "symbol",
		address: config.token_address
	})

	const program = new Program(wallet, rpcClient, config, symbol)

	await program.withdraw()
}

main()
