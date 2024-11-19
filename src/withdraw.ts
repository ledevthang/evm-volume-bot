import {
	type Address,
	createPublicClient,
	createWalletClient,
	type Hex,
	http
} from "viem"
import { parseConfig } from "./parse-config.js"
import { privateKeyToAccount } from "viem/accounts"
import fs from "node:fs"
import { Program } from "./program.js"

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

	const wallets: {
		address: Address
		privateKey: Hex
	}[] = fs
		.readFileSync("wallets.txt", "utf-8")
		.split("\n")
		.filter(s => !!s)
		.map(s => JSON.parse(s))

	await program.withdraw(wallets)
}

main()
