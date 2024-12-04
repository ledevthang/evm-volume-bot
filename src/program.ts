import fs from "node:fs/promises"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { formatEther, parseEther } from "viem/utils"
import type {
	WalletClient,
	PublicClient,
	Address,
	Chain,
	Account,
	Hex
} from "viem"
import { ERC20 } from "./ecc20.abi.js"
import { isInsufficientError, sleep, tryToInsufficient } from "./utils.js"
import { OneInch } from "./services.js"
import { DateTime } from "luxon"

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

type TransferParams = {
	from: Account
	to: Address
	amount: bigint
}

export class Program {
	private oneInchClient = new OneInch()

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
			if (subAccounts.length === 0) {
				console.log("🦀 🦀 🦀 All sub_accounts are insufficient >> finished")
				return
			}

			const executingAccounts = subAccounts.map(({ account, pk }) => ({
				address: account.address,
				privateKey: pk
			}))

			await fs.writeFile(
				"evm-executing-wallets.txt",
				`${JSON.stringify(executingAccounts, null, 1)}`
			)

			const rs = await Promise.allSettled(
				subAccounts.map(async subAccount =>
					tryToInsufficient(() => this.trade(subAccount))
				)
			)

			subAccounts = []

			for (const result of rs) {
				if (result.status === "fulfilled") subAccounts.push(result.value)
			}

			if (subAccounts.length > 0)
				console.log(
					`switch to new accounts ${subAccounts.map(account => account.account.address)}`
				)

			await sleep(3_000)
		}
	}

	private async trade(subAccount: SubAccount): Promise<SubAccount> {
		if (subAccount.tradingTimes === this.config.subAccountTradingMax) {
			const newsubAccount =
				await this.createNewSubAccountAndTransferAssets(subAccount)

			return newsubAccount
		}

		if (subAccount.tradingTimes === 0) {
			await this.approve(subAccount)
		}

		await this.swap(subAccount)

		subAccount.tradingTimes++

		return this.trade(subAccount)
	}

	private async createNewSubAccountAndTransferAssets(subAccount: SubAccount) {
		const [newSubAccount] = await this.generateAccount(1)

		let [balance, tokenBalance] = await this.getBalanceAndTokenBalance(
			subAccount.account.address
		)

		const transferGas = await this.rpcClient.estimateGas({
			to: newSubAccount.account.address,
			account: subAccount.account
		})

		const transferTokenGas = await this.rpcClient.estimateContractGas({
			address: this.config.tokenAddress,
			abi: ERC20,
			account: subAccount.account,
			functionName: "transfer",
			args: [newSubAccount.account.address, tokenBalance]
		})

		const gasPrice = await this.rpcClient.getGasPrice()

		await this.transferToken({
			from: subAccount.account,
			to: newSubAccount.account.address,
			amount: bigint_percent(tokenBalance, 100)
		})

		balance = await this.rpcClient.getBalance({
			address: subAccount.account.address
		})

		await this.transferNative({
			from: subAccount.account,
			to: newSubAccount.account.address,
			amount: bigint_percent(
				balance - transferGas * gasPrice - transferTokenGas * gasPrice,
				90
			)
		})

		return newSubAccount
	}

	private async approve(subAccount: SubAccount) {
		const approveTx = await this.oneInchClient.generateApprove({
			chainId: this.config.chain.id,
			tokenAddress: this.config.tokenAddress
		})

		const hash = await this.mainWalletClient.sendTransaction({
			chain: this.config.chain,
			account: subAccount.account,
			data: approveTx.data,
			to: approveTx.to,
			gasPrice: BigInt(approveTx.gasPrice),
			value: BigInt(approveTx.value)
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })

		console.log(
			`${subAccount.account.address} has approved token ${this.config.tokenAddress} on 1inch`
		)
	}

	private async swap(subAccount: SubAccount) {
		const { amount, dst, src } = await this.calculateBeforeSwap(subAccount)

		const { tx, dstAmount } = await this.oneInchClient.generateSwapCallData(
			this.config.chain.id,
			{
				amount: amount.toString(),
				src,
				dst,
				from: subAccount.account.address,
				slippage: 1
			}
		)

		const hash = await this.mainWalletClient.sendTransaction({
			account: subAccount.account,
			chain: this.config.chain,
			data: tx.data,
			from: tx.from,
			to: tx.to,
			gas: BigInt(tx.gas),
			gasPrice: BigInt(tx.gasPrice),
			value: BigInt(tx.value)
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })

		console.log(
			`${subAccount.account.address} has swapped with`,
			Number(formatEther(amount)),
			`${src} to `,
			Number(formatEther(BigInt(dstAmount))),
			dst
		)
	}

	private async initTokensAndFee(subAccounts: SubAccount[]) {
		try {
			for (const subAccount of subAccounts) {
				await this.transferNative({
					from: this.mainAccount(),
					to: subAccount.account.address,
					amount: parseEther(this.config.initFee.toString())
				})

				await this.transferToken({
					from: this.mainAccount(),
					amount: parseEther(this.config.initToken.toString()),
					to: subAccount.account.address
				})
			}

			console.log("initialized tokens and fee")
		} catch (error: any) {
			console.error(`InitTokensAndFee error: ${error?.message}`)
		}
	}

	private async transferNative({ amount, from, to }: TransferParams) {
		const hash = await this.mainWalletClient.sendTransaction({
			from,
			to,
			value: amount,
			chain: this.config.chain,
			account: from
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })

		console.log(
			`transfered native from ${from.address} to ${to}`,
			Number(formatEther(amount))
		)
	}

	private async transferToken({ amount, from, to }: TransferParams) {
		const hash = await this.mainWalletClient.writeContract({
			address: this.config.tokenAddress,
			abi: ERC20,
			account: from,
			functionName: "transfer",
			chain: this.config.chain,
			args: [to, amount]
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })

		console.log(
			`transfered tokens from ${from.address} to ${to}`,
			Number(formatEther(amount))
		)
	}

	private async generateAccount(quantity: number): Promise<SubAccount[]> {
		return Promise.all(
			new Array(quantity).fill(1).map(async () => {
				const randomPk = generatePrivateKey()
				const account = privateKeyToAccount(randomPk)

				const data = JSON.stringify({
					address: account.address,
					privateKey: randomPk,
					createdAt: DateTime.now().toISO()
				})

				await fs.appendFile("evm-wallets.txt", `\n${data}`)

				return {
					account,
					tradingTimes: 0,
					pk: randomPk
				}
			})
		)
	}

	private async calculateBeforeSwap(subAccount: SubAccount) {
		const [balance, tokenBalance] = await this.getBalanceAndTokenBalance(
			subAccount.account.address
		)

		const price = await this.oneInchClient.spotPrice(this.config.chain.id, [
			NATIVE,
			this.config.tokenAddress
		])

		const nativePriceInUSD = Number(price[NATIVE])
		const tokenPriceInUSD = Number(price[this.config.tokenAddress])

		const balanceInUsd = Number(formatEther(balance)) * nativePriceInUSD

		const tokenBalanceInUsd =
			Number(formatEther(tokenBalance)) * tokenPriceInUSD

		console.log(
			`before swap ${subAccount.tradingTimes} ${subAccount.account.address}:`,
			{
				balanceInUsd,
				tokenBalanceInUsd
			}
		)

		const target = (balanceInUsd + tokenBalanceInUsd) / 2

		if (balanceInUsd > tokenBalanceInUsd) {
			const amount = balanceInUsd - target + percent(balanceInUsd, 10)

			return {
				amount: parseEther((amount / nativePriceInUSD).toString()),
				src: NATIVE,
				dst: this.config.tokenAddress
			}
		}

		const amount = tokenBalanceInUsd - target + percent(tokenBalanceInUsd, 10)

		return {
			amount: parseEther((amount / tokenPriceInUSD).toString()),
			src: this.config.tokenAddress,
			dst: NATIVE
		}
	}

	private async getBalanceAndTokenBalance(address: Address) {
		const balance = await this.rpcClient.getBalance({
			address
		})

		const tokenBalance = await this.rpcClient.readContract({
			abi: ERC20,
			functionName: "balanceOf",
			args: [address],
			address: this.config.tokenAddress
		})

		return [balance, tokenBalance]
	}

	private mainAccount(): Account {
		return this.mainWalletClient.account!
	}

	public async withdraw(accounts: { address: Address; privateKey: Hex }[]) {
		const mainAddress = this.mainAccount().address

		for (const account of accounts) {
			const wallet = privateKeyToAccount(account.privateKey)

			let [balance, tokenBalance] = await this.getBalanceAndTokenBalance(
				account.address
			)

			console.log(`${account.address} balance >>`, Number(formatEther(balance)))

			console.log(
				`${account.address} token_balance >>`,
				Number(formatEther(tokenBalance))
			)

			const gasPrice = await this.rpcClient.getGasPrice()

			if (tokenBalance > BigInt(0)) {
				try {
					await this.rpcClient.estimateContractGas({
						address: this.config.tokenAddress,
						abi: ERC20,
						account: wallet,
						functionName: "transfer",
						args: [mainAddress, tokenBalance]
					})

					await this.transferToken({
						from: wallet,
						to: mainAddress,
						amount: tokenBalance
					})

					console.log("done with draw tokens")
				} catch (error: any) {
					if (isInsufficientError(error)) {
						console.error("insufficient error")
					} else {
						console.error(error?.message)
					}
				}
			}

			if (balance > BigInt(0)) {
				try {
					balance = await this.rpcClient.getBalance({ address: wallet.address })

					const transferGas = await this.rpcClient.estimateGas({
						to: mainAddress,
						account: wallet
					})
					const amount =
						balance -
						transferGas * gasPrice -
						bigint_percent(transferGas * gasPrice, 95)

					if (amount > 0) {
						await this.transferNative({
							from: wallet,
							to: mainAddress,
							amount
						})
						console.log("done with draw native")
					} else {
						console.log("skip transfering native because of too small balance")
					}
				} catch (error: any) {
					if (isInsufficientError(error)) {
						console.error("insufficient error")
					} else {
						console.error(error?.message)
					}
				}
			}
		}
	}
}

function percent(value: number, percent: number) {
	return (value / 100) * percent
}

function bigint_percent(value: bigint, percent: number) {
	return (value / 100n) * BigInt(percent)
}
