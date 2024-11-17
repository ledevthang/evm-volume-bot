import Web3 from "web3"
import { type Config, Program } from "./program.js"
import { privateKeyToAccount } from "web3-eth-accounts"
import { ERC20 } from "./ecc20.abi.js"

async function main() {
	const rpcUrl = process.env.RPC
	const mainPk = process.env.PRIVATE_KEY
	const _1inchApiKey = process.env.API_1INCH_KEY

	if (!rpcUrl) throw new Error("missing RPC env")

	if (!mainPk) throw new Error("missing PRIVATE_KEY env")

	if (!_1inchApiKey) throw new Error("missing API_1INCH_KEY env")

	const web3 = new Web3(rpcUrl)

	const config: Config = {
		chainId: 43114,
		initFee: 0.02,
		initToken: 0.02,
		tokenAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
		subAccountConcurrency: 1,
		subAccountTradingMax: 6
	}

	const erc20contract = new web3.eth.Contract(ERC20, config.tokenAddress)

	const program = new Program(
		web3,
		privateKeyToAccount(mainPk),
		config,
		erc20contract
	)

	await program.run()
}

main()
