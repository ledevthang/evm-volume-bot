import type { Address, Contract, Web3 } from "web3"
import type { Web3Account } from "web3-eth-accounts"
import {
	type SwapParams,
	generateApprove,
	generateSwapCallData
} from "./services.js"
import fs from "node:fs/promises"
import type { ERC20 } from "./ecc20.abi.js"

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
export type Config = {
	chainId: number
	tokenAddress: Address
	initFee: number
	initToken: number
	subAccountConcurrency: number
	subAccountTradingMax: number
}

type SubAccount = {
	account: Web3Account
	tradingTimes: number
}

export class Program {
	constructor(
		private web3: Web3,
		private mainAccount: Web3Account,
		private config: Config,
		private erc20Contract: Contract<typeof ERC20>
	) {
		this.web3.eth.accounts.wallet.add(this.mainAccount)
	}

	public async run() {
		let subAccounts = await this.generateAccount(
			this.config.subAccountConcurrency
		)

		await this.initTokensAndFee(subAccounts)

		for (;;) {
			const executingAccounts = subAccounts.map(({ account }) => ({
				address: account.address,
				privateKey: account.privateKey
			}))

			await fs.writeFile(
				"executing-wallets.txt",
				`${JSON.stringify(executingAccounts, null, 1)}\n`
			)

			subAccounts = await Promise.all(
				subAccounts.map(subAccount => this.trade(subAccount))
			)

			await sleep(10e3)
		}
	}

	private async trade(subAccount: SubAccount): Promise<SubAccount> {
		if (subAccount.tradingTimes === this.config.subAccountTradingMax) {
			const [newSubAccount] = await this.generateAccount(1)

			await this.transferTokensAndFee(
				subAccount.account.address,
				newSubAccount.account.address,
				1,
				1
			)
			this.web3.eth.accounts.wallet.remove(subAccount.account.address)

			return newSubAccount
		}

		if (subAccount.tradingTimes === 0) {
			await this.approve(subAccount)
		}

		await this.swap(subAccount)

		subAccount.tradingTimes++

		return this.trade(subAccount)
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
			subAccount.account.privateKey
		)

		const tx = await this.web3.eth.sendSignedTransaction(rawTransaction)

		if (tx.status) {
			console.log(`approve success from account ${subAccount.account.address}`)
		}
	}

	private async swap(subAccount: SubAccount) {
		const [src, dst] = this.getSrcAndDst(subAccount)

		const swapParams: SwapParams = {
			amount: this.web3.utils.toWei("0.001", "ether"),
			src,
			dst,
			from: subAccount.account.address,
			slippage: 1
		}

		const { tx } = await generateSwapCallData(this.config.chainId, swapParams)

		const result = await this.web3.eth.sendTransaction(tx)

		if (result.status) {
			console.log(`swap success from account ${subAccount.account.address}`)
		}
	}

	private async initTokensAndFee(subAccounts: SubAccount[]) {
		for (const subAccount of subAccounts) {
			await this.transferTokensAndFee(
				this.mainAccount.address,
				subAccount.account.address,
				this.config.initToken,
				this.config.initFee
			)
		}

		console.log("initialized tokens and fee")
	}

	private async transferTokensAndFee(
		from: Address,
		to: Address,
		tokenAmount: number,
		feeAmount: number
	) {
		const tx = await this.web3.eth.accounts.signTransaction(
			{
				from,
				to,
				value: this.web3.utils.toWei(feeAmount, "ether")
			},
			this.mainAccount.privateKey
		)

		await this.web3.eth.sendTransaction(tx)

		console.log(`transfered fee from ${from} to ${to} >> amount ${feeAmount}`)

		await this.erc20Contract.methods
			.transfer(to, this.web3.utils.toWei(this.config.initToken, "ether"))
			.send({
				from
			})

		console.log(`transfered tokens from ${from} to ${to} ${tokenAmount}`)
	}

	private async generateAccount(quantity: number): Promise<SubAccount[]> {
		return Promise.all(
			new Array(quantity).fill(1).map(async () => {
				const account = this.web3.eth.accounts.create()
				const data = JSON.stringify({
					address: account.address,
					privateKey: account.privateKey
				})

				this.web3.eth.accounts.wallet.add(account)

				await fs.appendFile("wallets.txt", `${data}\n`)

				return {
					account,
					tradingTimes: 0
				}
			})
		)
	}

	private getSrcAndDst(subAccount: SubAccount) {
		return subAccount.tradingTimes % 2 === 0
			? [NATIVE, this.config.tokenAddress]
			: [this.config.tokenAddress, NATIVE]
	}
}

function sleep(duration: number) {
	return new Promise(res => setTimeout(res, duration))
}
