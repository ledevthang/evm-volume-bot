import fs from "node:fs/promises"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { formatEther, parseEther } from "viem/utils"
import {
	type WalletClient,
	type PublicClient,
	type Address,
	type Account,
	erc20Abi
} from "viem"
import {
	bigintPercent,
	random,
	randomInt,
	sleep,
	tryToInsufficient
} from "./utils.js"
import { OneInch } from "./services.js"
import { DateTime } from "luxon"
import type { Config } from "./parse-config.js"
import { Decimal } from "decimal.js"
import { Logger } from "./logger.js"
import { decryptWallet, encryptWallet } from "./hashing.js"

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const

type SwapParams = {
	account: Account
	src: Address
	dst: Address
	amount: bigint
}

type TransferParams = {
	from: Account
	to: Address
	amount: bigint
}

export class Program {
	private oneInchClient = new OneInch()

	constructor(
		private wallet: WalletClient,
		private rpcClient: PublicClient,
		private config: Config,
		private tokenSymbol: string
	) {}

	public async run() {
		let account = this.account()

		for (;;) {
			account = await tryToInsufficient(() => this.executeTrades(account))
		}
	}

	private async executeTrades(account: Account): Promise<Account> {
		await this.approveSwap(account)

		let buyCount = 0
		let sellCount = 0
		let isBuy = true

		for (;;) {
			if (buyCount === this.config.consecutive_buys) isBuy = false

			if (
				buyCount >= this.config.consecutive_buys &&
				sellCount >= this.config.consecutive_sells
			)
				return this.createNewAccountAndTransfer(account)

			const [ethBalance, tokenBalance] = await this.balance(account.address)

			Logger.info("balance::", {
				ethBalance: formatEther(ethBalance),
				[`${this.tokenSymbol}Balance`]: formatEther(tokenBalance)
			})

			const randUiAmount = random(this.config.min_eth, this.config.max_eth)
			const amount = parseEther(new Decimal(randUiAmount).toFixed())

			if (isBuy && ethBalance < amount) {
				Logger.error(
					`Insufficient ETH for buy. Required: ${formatEther(amount)}, Available: ${formatEther(ethBalance)}`
				)
				await sleep(2_000)
				continue
			}

			if (!isBuy && tokenBalance < amount) {
				Logger.error(
					`Insufficient ${this.tokenSymbol} for sell. Required: ${formatEther(amount)}, Available: ${formatEther(tokenBalance)}`
				)
				await sleep(2_000)
				continue
			}

			await this.swap({
				account,
				amount,
				src: isBuy ? NATIVE : this.config.token_address,
				dst: isBuy ? this.config.token_address : NATIVE
			})

			if (isBuy) buyCount++
			else sellCount++

			const restTime =
				random(this.config.wait_time_min, this.config.wait_time_max) * 1000

			await sleep(restTime)
		}
	}

	private async approveSwap(account: Account) {
		const allowance = await this.oneInchClient.getAllowance(
			this.config.chain.id,
			account.address,
			this.config.token_address
		)

		if (allowance > 0) {
			return
		}

		const approveTx = await this.oneInchClient.generateApprove({
			chainId: this.config.chain.id,
			tokenAddress: this.config.token_address
		})

		const hash = await this.wallet.sendTransaction({
			chain: this.config.chain,
			account,
			data: approveTx.data,
			to: approveTx.to,
			gasPrice: BigInt(approveTx.gasPrice),
			value: BigInt(approveTx.value)
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })
	}

	private async swap({ amount, dst, src, account }: SwapParams) {
		const { tx, dstAmount } = await this.oneInchClient.generateSwapCallData(
			this.config.chain.id,
			{
				amount: amount.toString(),
				src,
				dst,
				from: account.address,
				slippage: this.config.slippage
			}
		)

		const hash = await this.wallet.sendTransaction({
			account,
			chain: this.config.chain,
			data: tx.data,
			from: tx.from,
			to: tx.to,
			gas: BigInt(tx.gas),
			gasPrice: BigInt(tx.gasPrice),
			value: BigInt(tx.value)
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })

		const message =
			src === NATIVE
				? `Buy ${formatEther(BigInt(dstAmount))} ${this.tokenSymbol} @ ${formatEther(BigInt(amount))} ETH`
				: `Sell ${formatEther(amount)} ${this.tokenSymbol} @ ${formatEther(BigInt(dstAmount))} ETH`

		Logger.info(message)
	}

	private async transferEth({ amount, from, to }: TransferParams) {
		const hash = await this.wallet.sendTransaction({
			from,
			to,
			value: amount,
			chain: this.config.chain,
			account: from
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })
	}

	private async transferToken({ amount, from, to }: TransferParams) {
		const hash = await this.wallet.writeContract({
			address: this.config.token_address,
			abi: erc20Abi,
			account: from,
			functionName: "transfer",
			chain: this.config.chain,
			args: [to, amount]
		})

		await this.rpcClient.waitForTransactionReceipt({ hash })
	}

	private async createNewAccountAndTransfer(
		previousAccount: Account
	): Promise<Account> {
		const randomPk = generatePrivateKey()
		const newAccount = privateKeyToAccount(randomPk)

		let [ethBalance, tokenBalance] = await this.balance(previousAccount.address)

		const encrypted = encryptWallet({
			address: newAccount.address,
			privateKey: randomPk,
			createdAt: DateTime.now()
		})

		await fs.appendFile("evm-wallets.txt", `\n${encrypted}`)

		await this.transferToken({
			from: previousAccount,
			to: newAccount.address,
			amount: bigintPercent(tokenBalance, 99)
		})

		const gasPrice = await this.rpcClient.getGasPrice()

		const transferEthGas = await this.rpcClient.estimateGas({
			to: newAccount.address,
			account: previousAccount
		})

		ethBalance = await this.rpcClient.getBalance({
			address: newAccount.address
		})

		const ethNeedToTransfer = ethBalance - transferEthGas * gasPrice

		await this.transferEth({
			from: previousAccount,
			to: newAccount.address,
			amount: ethNeedToTransfer
		})

		return newAccount
	}

	private account(): Account {
		return this.wallet.account!
	}

	private async balance(address: Address) {
		const ethBalance = await this.rpcClient.getBalance({
			address
		})

		const tokenBalance = await this.rpcClient.readContract({
			address: this.config.token_address,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [address]
		})

		return [ethBalance, tokenBalance]
	}

	public async withdraw() {
		const wallets = await fs
			.readFile("evm-wallets.txt", "utf8")
			.then(rawLines => rawLines.split("\n"))
			.then(lines => lines.filter(Boolean))
			.then(rawWallets => rawWallets.map(decryptWallet))

		for (const wallet of wallets) {
			let [ethBalance, tokenBalance] = await this.balance(wallet.address)

			const account = privateKeyToAccount(wallet.privateKey)

			if (tokenBalance > BigInt(0)) {
				try {
					await this.transferToken({
						from: account,
						to: this.account().address,
						amount: tokenBalance
					})

					Logger.info(
						`withdraw ${formatEther(tokenBalance)} ${this.tokenSymbol} from ${account.address}`
					)
				} catch (error: any) {
					Logger.error(
						`withdraw error: ${JSON.stringify(
							{
								code: error?.code,
								name: error?.name,
								details: error?.details
							},
							null,
							1
						)}`
					)
				}
			}

			if (ethBalance > BigInt(0)) {
				try {
					const gasPrice = await this.rpcClient.getGasPrice()

					const transferEthGas = await this.rpcClient.estimateGas({
						to: this.account().address,
						account
					})

					ethBalance = await this.rpcClient.getBalance({
						address: account.address
					})

					const ethNeedToTransfer = ethBalance - transferEthGas * gasPrice

					await this.transferEth({
						from: account,
						to: this.account().address,
						amount: ethNeedToTransfer
					})

					Logger.info(
						`withdraw ${formatEther(ethNeedToTransfer)} ETH from ${account.address}`
					)
				} catch (error: any) {
					Logger.error(
						`withdraw error: ${JSON.stringify(
							{
								code: error?.code,
								name: error?.name,
								details: error?.details
							},
							null,
							1
						)}`
					)
				}
			}
		}
	}
}
