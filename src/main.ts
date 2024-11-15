import Web3 from "web3"
import { Program } from "./program.js"
import { Defender } from "@openzeppelin/defender-sdk"

async function main() {
	const rpcUrl = process.env.RPC
	const mainPk = process.env.PRIVATE_KEY
	const _1inchApiKey = process.env.API_1INCH_KEY

	const relayerApiKey = process.env.API_RELAYER_KEY
	const relayerApiSecret = process.env.RELAYER_API_SECRET

	if (!rpcUrl) throw new Error("missing RPC env")

	if (!mainPk) throw new Error("missing PRIVATE_KEY env")

	if (!_1inchApiKey) throw new Error("missing API_1INCH_KEY env")

	if (!relayerApiKey) throw new Error("missing API_RELAYER_KEY env")

	if (!relayerApiSecret) throw new Error("missing RELAYER_API_SECRET env")

	const defender = new Defender({
		relayerApiKey,
		relayerApiSecret
	})

	const web3 = new Web3(rpcUrl)

	web3.eth.accounts.wallet.add(mainPk)

	const program = new Program(web3, web3.eth.wallet?.get(0)!, defender, {
		chainId: 43114,
		tokenAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
	})

	await program.run()
}

main()
