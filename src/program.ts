import {
	type SwapParams,
	generateApprove,
	generateSwapCallData
} from "./services.js"
import fs from "node:fs/promises"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { parseEther } from "viem/utils"

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const

type PrivateKey = Address

export type Config = {
	chain: Chain
	tokenAddress: Address
	initFee: number
	initToken: number
	subAccountConcurrency: number
	subAccountTradingMax: number
}

type SubAccount = {
	account: Account
	pk: PrivateKey
	tradingTimes: number
}
import type { WalletClient, PublicClient, Address, Chain, Account } from "viem"
import { ERC20 } from "./ecc20.abi.js"
export class Program {
	constructor(
		private mainWalletClient: WalletClient,
		private rpcClient: PublicClient,
		private config: Config
	) {}

	public async run() {
		let subAccounts = await this.generateAccount(
			this.config.subAccountConcurrency
		)

		await this.initTokensAndFee(subAccounts)

		for (;;) {
			const executingAccounts = subAccounts.map(({ account, pk }) => ({
				address: account.address,
				privateKey: pk
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
				subAccount.account,
				newSubAccount.account.address,
				1,
				1
			)

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
			chainId: this.config.chain.id,
			tokenAddress: this.config.tokenAddress
		})

		const gasLimit = await this.rpcClient.estimateGas({
			data: approveTx.data,
			account: subAccount.account,
			gasPrice: BigInt(approveTx.gasPrice),
			to: approveTx.to,
			value: BigInt(approveTx.value)
		})

		// const data = {
		// 	data: approveTx.data,
		// 	account: subAccount.account,
		// 	gasPrice: BigInt(approveTx.gasPrice),
		// 	to: approveTx.to,
		// 	value: BigInt(approveTx.value),
		// 	gas: gasLimit,
		// 	nonce: await this.rpcClient.getTransactionCount({
		// 		address: subAccount.account.address
		// 	})
		// }

		const rawTransaction = await this.mainWalletClient.signTransaction({
			chain: this.config.chain,
			account: subAccount.account
		})

		await this.mainWalletClient.sendRawTransaction({
			serializedTransaction: rawTransaction
		})
	}

	private async swap(subAccount: SubAccount) {
		const [src, dst] = this.getSrcAndDst(subAccount)

		const swapParams: SwapParams = {
			amount: parseEther("0.001").toString(),
			src,
			dst,
			from: subAccount.account.address,
			slippage: 1
		}

		const { tx } = await generateSwapCallData(this.config.chain.id, swapParams)

		await this.mainWalletClient.sendTransaction({
			account: subAccount.account,
			chain: this.config.chain,
			data: tx.data,
			from: tx.from,
			gas: BigInt(tx.gas),
			gasPrice: BigInt(tx.gasPrice),
			to: tx.to,
			value: BigInt(tx.value)
		})

		console.log(`swap success from account ${subAccount.account.address}`)
	}

	private async initTokensAndFee(subAccounts: SubAccount[]) {
		for (const subAccount of subAccounts) {
			await this.transferTokensAndFee(
				this.mainAccount(),
				subAccount.account.address,
				this.config.initToken,
				this.config.initFee
			)
		}

		console.log("initialized tokens and fee")
	}

	private async transferTokensAndFee(
		from: Account,
		to: Address,
		tokenAmount: number,
		feeAmount: number
	) {
		const transferFee = await this.mainWalletClient.sendTransaction({
			from,
			to,
			value: parseEther(feeAmount.toString()),
			chain: this.config.chain,
			account: from
		})

		console.log(
			`transfered fee from ${from} to ${to}  amount ${feeAmount} >> hash ${transferFee}`
		)

		const transferTokens = await this.mainWalletClient.writeContract({
			address: this.config.tokenAddress,
			abi: ERC20,
			account: from,
			functionName: "transfer",
			chain: this.config.chain,
			args: [to, parseEther(tokenAmount.toString())]
		})

		console.log(
			`transfered tokens from ${from} to ${to} ${tokenAmount} >> hash ${transferTokens}`
		)
	}

	private async generateAccount(quantity: number): Promise<SubAccount[]> {
		return Promise.all(
			new Array(quantity).fill(1).map(async () => {
				const randomPk = generatePrivateKey()
				const account = privateKeyToAccount(randomPk)

				const data = JSON.stringify({
					address: account.address,
					privateKey: randomPk
				})

				await fs.appendFile("wallets.txt", `${data}\n`)

				return {
					account,
					tradingTimes: 0,
					pk: randomPk
				}
			})
		)
	}

	private getSrcAndDst(subAccount: SubAccount) {
		return subAccount.tradingTimes % 2 === 0
			? [NATIVE, this.config.tokenAddress]
			: [this.config.tokenAddress, NATIVE]
	}

	private mainAccount(): Account {
		return this.mainWalletClient.account!
	}
}

function sleep(duration: number) {
	return new Promise(res => setTimeout(res, duration))
}
