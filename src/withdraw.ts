// import {
// 	type Address,
// 	createPublicClient,
// 	createWalletClient,
// 	fallback,
// 	type Hex,
// 	http
// } from "viem"
// import { parseConfig } from "./parse-config.js"
// import { privateKeyToAccount } from "viem/accounts"
// import fs from "node:fs"
// import { Program } from "./program.js"

// async function main() {
// 	const { config, pk, rpc1, rpc2 } = parseConfig()

// 	const transport = fallback([http(rpc1), http(rpc2)])

// 	const rpcClient = createPublicClient({
// 		transport
// 	})

// 	const mainWalletClient = createWalletClient({
// 		transport,
// 		account: privateKeyToAccount(pk)
// 	})

// 	const program = new Program(mainWalletClient, rpcClient, config)

// 	const wallets: {
// 		address: Address
// 		privateKey: Hex
// 	}[] = fs
// 		.readFileSync("evm-wallets.txt", "utf-8")
// 		.split("\n")
// 		.filter(s => !!s)
// 		.map(s => JSON.parse(s))

// 	await program.withdraw(wallets)
// }

// main()
