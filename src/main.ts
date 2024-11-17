import { Program } from "./program.js"
import { parseConfig } from "./parse-config.js"
import { privateKeyToAccount } from "viem/accounts"
import { createPublicClient, createWalletClient, http } from "viem"

async function main() {
	const { config, pk, rpc } = parseConfig()

	const transport = http(rpc)

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
