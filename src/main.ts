import Web3 from "web3"
import { Program } from "./program.js"

async function main() {
	const rpcUrl = process.env.RPC
	const mainPk = process.env.PRIVATE_KEY
	const _1inchApiKey = process.env.API_1INCH_KEY

	if (!rpcUrl) throw new Error("missing RPC env")

	if (!mainPk) throw new Error("missing PRIVATE_KEY env")

	if (!_1inchApiKey) throw new Error("missing API_1INCH_KEY env")

	const web3 = new Web3(rpcUrl)

	web3.eth.accounts.wallet.add(mainPk)

	const program = new Program(web3, web3.eth.wallet?.get(0)!, {
		chainId: 43114,
		tokenAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
	})

	await program.run()
}

main()
