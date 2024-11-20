import { Program } from "./program.js"
import { parseConfig } from "./parse-config.js"
import { privateKeyToAccount } from "viem/accounts"
import { createPublicClient, createWalletClient, fallback, http } from "viem"

async function main() {
	const { config, pk, rpc1,rpc2 } = parseConfig()

	const transport = fallback([http(rpc1), http(rpc2)])

	const rpcClient = createPublicClient({
		transport
	})

	const mainWalletClient = createWalletClient({
		transport,
		account: privateKeyToAccount(pk)
	})


	const program = new Program(mainWalletClient, rpcClient, config)

	await program.run()
}

main()
