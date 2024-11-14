import type { Address, Web3 } from "web3"
import type { Web3Account } from "web3-eth-accounts"
import {
	type SwapParams,
	generateApprove,
	generateSwapCallData
} from "./services.js"

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

type SubAccount = {
	account: Web3Account
	tradingTimes: number
}

type Config = {
	chainId: number
	tokenAddress: Address
}

export class Program {
	constructor(
		private web3: Web3,
		private mainAccount: Web3Account,
		private config: Config
	) {}

	public async run() {
		// for (let i = 1; i < 10; i++)
		await this.trade({
			account: this.mainAccount,
			tradingTimes: 1
		})
	}

	private async trade(subAccount: SubAccount) {
		// await this.approve(subAccount)
		await this.swap(subAccount)
	}

	private async approve(subAccount: SubAccount) {
		const approveTx = await generateApprove({
			chainId: this.config.chainId,
			tokenAddress: this.config.tokenAddress
		})

		const gasLimit = await this.web3.eth.estimateGas({
			...approveTx,
			from: subAccount.account.address
		})

		const data = {
			...approveTx,
			gas: gasLimit,
			nonce: await this.web3.eth.getTransactionCount(subAccount.account.address)
		}

		const { rawTransaction } = await this.web3.eth.accounts.signTransaction(
			data,
			process.env.PRIVATE_KEY as string
		)

		console.log(rawTransaction)

		const tx = await this.web3.eth.sendSignedTransaction(rawTransaction)

		if (tx.status) {
			console.log("approve success!")
		}
	}

	private async swap(subAccount: SubAccount) {
		const src =
			subAccount.tradingTimes % 2 === 0 ? NATIVE : this.config.tokenAddress

		const dst = src === NATIVE ? this.config.tokenAddress : NATIVE

		const swapParams: SwapParams = {
			amount: this.web3.utils.toWei("0.001", "ether"),
			dst,
			src,
			from: subAccount.account.address,
			slippage: 1
		}

		const { tx } = await generateSwapCallData(this.config.chainId, swapParams)

		const result = await this.web3.eth.sendTransaction(tx)

		if (result.status) {
			console.log("swap success!")
		}
	}
}
