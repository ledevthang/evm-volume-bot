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
import { sleep } from "./sleep.js"
import { OneInch } from "./services.js"
import { DateTime } from "luxon"
import { Boolean as Bool, Chunk, Effect, pipe } from "effect"
import {
	FsError,
	type OneInchError,
	type Result,
	RpcRequestError,
	type UnknownError
} from "./error.js"

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
		let subAccounts = await pipe(
			this.generateAccount(this.config.subAccountConcurrency),
			Effect.tap(subAccounts => this.initTokensAndFee(subAccounts)),
			Effect.runPromise
		)

		for (;;) {
			const executingAccounts = subAccounts.map(({ account, pk }) => ({
				address: account.address,
				privateKey: pk
			}))

			await fs.writeFile(
				"executing-wallets.txt",
				`${JSON.stringify(executingAccounts, null, 1)}`
			)

			subAccounts = await pipe(
				subAccounts,
				Chunk.fromIterable,
				Chunk.map(subAccount => this.trade(subAccount)),
				tasks =>
					Effect.all(tasks, {
						concurrency: this.config.subAccountConcurrency
					}),
				Effect.runPromise
			)

			console.log(
				`switch to new accounts ${subAccounts.map(account => account.account.address)}`
			)

			await sleep(3_000)
		}
	}

	private createNewSubAccountAndTransferAssets(subAccount: SubAccount) {
		return pipe(
			this.generateAccount(1),
			Effect.map(accounts => accounts[0]),
			Effect.bindTo("newSubAccount"),
			Effect.bind("assets", ({ newSubAccount }) =>
				this.getBalanceAndTokenBalance(newSubAccount.account.address)
			),
			Effect.bind("transferGas", ({ newSubAccount }) =>
				Effect.tryPromise({
					try: () =>
						this.rpcClient.estimateGas({
							to: newSubAccount.account.address,
							account: subAccount.account
						}),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.bind("transferTokenGas", ({ newSubAccount, assets }) =>
				Effect.tryPromise({
					try: () =>
						this.rpcClient.estimateContractGas({
							address: this.config.tokenAddress,
							abi: ERC20,
							account: subAccount.account,
							functionName: "transfer",
							args: [newSubAccount.account.address, assets.tokenBalance]
						}),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.bind("gasPrice", () =>
				Effect.tryPromise({
					try: () => this.rpcClient.getGasPrice(),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.tap(({ assets, newSubAccount }) =>
				this.transferToken({
					from: subAccount.account,
					to: newSubAccount.account.address,
					amount: bigint_percent(assets.tokenBalance, 100)
				})
			),
			Effect.bind("newBalance", () =>
				Effect.tryPromise({
					try: () =>
						this.rpcClient.getBalance({
							address: subAccount.account.address
						}),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.tap(
				({
					newBalance,
					newSubAccount,
					transferGas,
					transferTokenGas,
					gasPrice
				}) =>
					this.transferNative({
						from: subAccount.account,
						to: newSubAccount.account.address,
						amount: bigint_percent(
							newBalance - transferGas * gasPrice - transferTokenGas * gasPrice,
							90
						)
					})
			),
			Effect.map(({ newSubAccount }) => newSubAccount)
		)
	}

	private trade(
		subAccount: SubAccount
	): Result<
		SubAccount,
		FsError | RpcRequestError | OneInchError | UnknownError
	> {
		return pipe(
			subAccount.tradingTimes === this.config.subAccountTradingMax,
			Bool.match({
				onTrue: () => this.createNewSubAccountAndTransferAssets(subAccount),
				onFalse: () =>
					pipe(
						Effect.if(subAccount.tradingTimes === 0, {
							onTrue: () => this.approve(subAccount),
							onFalse: () => Effect.void
						}),
						Effect.flatMap(() => this.swap(subAccount)),
						Effect.tap(() => subAccount.tradingTimes++),
						Effect.flatMap(() => this.trade(subAccount))
					)
			})
		)
	}

	private approve(
		subAccount: SubAccount
	): Result<void, RpcRequestError | OneInchError | UnknownError> {
		return pipe(
			this.oneInchClient.generateApprove({
				chainId: this.config.chain.id,
				tokenAddress: this.config.tokenAddress
			}),
			Effect.flatMap(approveTx =>
				Effect.tryPromise({
					try: () =>
						this.mainWalletClient.sendTransaction({
							chain: this.config.chain,
							account: subAccount.account,
							data: approveTx.data,
							to: approveTx.to,
							gasPrice: BigInt(approveTx.gasPrice),
							value: BigInt(approveTx.value)
						}),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.flatMap(hash =>
				Effect.tryPromise({
					try: () => this.rpcClient.waitForTransactionReceipt({ hash }),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.tap(() =>
				Effect.log(
					`${subAccount.account.address} has approved token ${this.config.tokenAddress} on 1inch`
				)
			)
		)
	}

	private swap(
		subAccount: SubAccount
	): Result<
		void,
		RpcRequestError | OneInchError | RpcRequestError | UnknownError
	> {
		return pipe(
			this.calculateBeforeSwap(subAccount),
			Effect.bind("callDataResponse", ({ amount, dst, src }) =>
				this.oneInchClient.generateSwapCallData(this.config.chain.id, {
					amount: amount.toString(),
					src,
					dst,
					from: subAccount.account.address,
					slippage: 1
				})
			),
			Effect.bind("hash", ({ callDataResponse: { tx } }) =>
				Effect.tryPromise({
					try: async () =>
						this.mainWalletClient.sendTransaction({
							account: subAccount.account,
							chain: this.config.chain,
							data: tx.data,
							from: tx.from,
							to: tx.to,
							gas: BigInt(tx.gas),
							gasPrice: BigInt(tx.gasPrice),
							value: BigInt(tx.value)
						}),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.tap(({ hash }) =>
				Effect.tryPromise({
					try: () => this.rpcClient.waitForTransactionReceipt({ hash }),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.tap(({ src, dst, amount, callDataResponse: { dstAmount } }) =>
				Effect.log(
					`${subAccount.account.address} has swapped with ${formatEther(amount)} ${src} to ${formatEther(BigInt(dstAmount))} ${dst}`
				)
			)
		)
	}

	private initTokensAndFee(
		subAccounts: SubAccount[]
	): Result<void, RpcRequestError> {
		return pipe(
			subAccounts,
			Chunk.fromIterable,
			Chunk.map(subAccount =>
				pipe(
					this.transferNative({
						from: this.mainAccount(),
						to: subAccount.account.address,
						amount: parseEther(this.config.initFee.toString())
					}),
					Effect.flatMap(() =>
						this.transferToken({
							from: this.mainAccount(),
							amount: parseEther(this.config.initToken.toString()),
							to: subAccount.account.address
						})
					)
				)
			),
			Effect.all,
			Effect.tap(() => Effect.log("initialized tokens and fee"))
		)
	}

	private transferNative({
		amount,
		from,
		to
	}: TransferParams): Result<void, RpcRequestError> {
		return pipe(
			Effect.tryPromise({
				try: () =>
					this.mainWalletClient.sendTransaction({
						from,
						to,
						value: amount,
						chain: this.config.chain,
						account: from
					}),
				catch: error => new RpcRequestError(error)
			}),
			Effect.flatMap(hash =>
				Effect.tryPromise({
					try: () => this.rpcClient.waitForTransactionReceipt({ hash }),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.tap(() =>
				Effect.log(
					`transfered native from ${from.address} to ${to} ${formatEther(amount)}`
				)
			)
		)
	}

	private transferToken({
		amount,
		from,
		to
	}: TransferParams): Result<void, RpcRequestError> {
		return pipe(
			Effect.tryPromise({
				try: () =>
					this.mainWalletClient.writeContract({
						address: this.config.tokenAddress,
						abi: ERC20,
						account: from,
						functionName: "transfer",
						chain: this.config.chain,
						args: [to, amount]
					}),
				catch: error => new RpcRequestError(error)
			}),
			Effect.flatMap(hash =>
				Effect.tryPromise({
					try: () => this.rpcClient.waitForTransactionReceipt({ hash }),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.tap(() =>
				Effect.log(
					`transfered tokens from ${from.address} to ${to} ${formatEther(amount)}`
				)
			)
		)
	}

	private generateAccount(quantity: number): Result<SubAccount[], FsError> {
		return pipe(
			Chunk.fromIterable(new Array(quantity).fill(1)),
			Chunk.map(() =>
				Effect.tryPromise({
					try: async () => {
						const randomPk = generatePrivateKey()
						const account = privateKeyToAccount(randomPk)
						const dataAppend = JSON.stringify({
							address: account.address,
							privateKey: randomPk,
							createdAt: DateTime.now().toISO()
						})
						await fs.appendFile("wallets.txt", `\n${dataAppend}`)

						return {
							account,
							tradingTimes: 0,
							pk: randomPk
						}
					},
					catch: error => new FsError(error)
				})
			),
			tasks => Effect.all(tasks, { concurrency: quantity })
		)
	}

	private calculateBeforeSwap(subAccount: SubAccount): Result<
		{
			src: Address
			dst: Address
			amount: bigint
		},
		OneInchError | RpcRequestError | UnknownError
	> {
		return pipe(
			this.getBalanceAndTokenBalance(subAccount.account.address),
			Effect.bind("price", () =>
				this.oneInchClient.spotPrice(this.config.chain.id, [
					NATIVE,
					this.config.tokenAddress
				])
			),
			Effect.let("nativePriceInUSD", ({ price }) => Number(price[NATIVE])),
			Effect.let("tokenPriceInUSD", ({ price }) =>
				Number(price[this.config.tokenAddress])
			),
			Effect.let(
				"balanceInUsd",
				({ balance, nativePriceInUSD }) =>
					Number(formatEther(balance)) * nativePriceInUSD
			),
			Effect.let(
				"tokenBalanceInUsd",
				({ tokenBalance, tokenPriceInUSD }) =>
					Number(formatEther(tokenBalance)) * tokenPriceInUSD
			),
			Effect.tap(({ balanceInUsd, tokenBalanceInUsd }) =>
				Effect.log("before swap $: ", { balanceInUsd, tokenBalanceInUsd })
			),
			Effect.map(
				({
					balanceInUsd,
					nativePriceInUSD,
					tokenBalanceInUsd,
					tokenPriceInUSD
				}) => {
					const target = (balanceInUsd + tokenBalanceInUsd) / 2

					if (balanceInUsd > tokenBalanceInUsd) {
						const amount = balanceInUsd - target + percent(balanceInUsd, 20)

						return {
							amount: parseEther((amount / nativePriceInUSD).toString()),
							src: NATIVE,
							dst: this.config.tokenAddress
						}
					}

					const amount =
						tokenBalanceInUsd - target + percent(tokenBalanceInUsd, 20)

					return {
						amount: parseEther((amount / tokenPriceInUSD).toString()),
						src: this.config.tokenAddress,
						dst: NATIVE
					}
				}
			)
		)
	}

	private getBalanceAndTokenBalance(address: Address): Result<
		{
			balance: bigint
			tokenBalance: bigint
		},
		RpcRequestError
	> {
		return pipe(
			Effect.Do,
			Effect.bind("balance", () =>
				Effect.tryPromise({
					try: () => this.rpcClient.getBalance({ address }),
					catch: error => new RpcRequestError(error)
				})
			),
			Effect.bind("tokenBalance", () =>
				Effect.tryPromise({
					try: () =>
						this.rpcClient.readContract({
							abi: ERC20,
							functionName: "balanceOf",
							args: [address],
							address: this.config.tokenAddress
						}),
					catch: error => new RpcRequestError(error)
				})
			)
		)
	}

	private mainAccount(): Account {
		return this.mainWalletClient.account!
	}

	public withdraw(accounts: { address: Address; privateKey: Hex }[]) {
		const mainAddress = this.mainAccount().address
		return pipe(
			accounts,
			Chunk.fromIterable,
			Chunk.map(account =>
				pipe(
					Effect.Do,
					Effect.let("wallet", () => privateKeyToAccount(account.privateKey)),
					Effect.bind("assets", () =>
						this.getBalanceAndTokenBalance(account.address)
					),
					Effect.tap(({ assets }) =>
						Effect.log(
							`${account.address} balance >> ${formatEther(assets.balance)}`
						)
					),
					Effect.tap(({ assets }) =>
						Effect.log(
							`${account.address} token_balance >> ${formatEther(assets.tokenBalance)}`
						)
					),
					Effect.tap(({ assets, wallet }) =>
						Effect.if(assets.tokenBalance > BigInt(0), {
							onFalse: () => Effect.void,
							onTrue: () =>
								this.transferToken({
									from: wallet,
									to: mainAddress,
									amount: assets.tokenBalance
								}).pipe(Effect.tap(() => Effect.log("done with draw tokens")))
						})
					),
					Effect.tap(({ assets, wallet }) =>
						Effect.if(assets.balance > BigInt(0), {
							onFalse: () => Effect.void,
							onTrue: () =>
								pipe(
									Effect.tryPromise({
										try: () =>
											this.rpcClient.getBalance({ address: wallet.address }),
										catch: error => new RpcRequestError(error)
									}),
									Effect.bindTo("balance"),
									Effect.bind("transferGas", () =>
										Effect.tryPromise({
											try: () =>
												this.rpcClient.estimateGas({
													to: mainAddress,
													account: wallet
												}),
											catch: error => new RpcRequestError(error)
										})
									),
									Effect.bind("gasPrice", () =>
										Effect.tryPromise({
											try: () => this.rpcClient.getGasPrice(),
											catch: error => new RpcRequestError(error)
										})
									),
									Effect.flatMap(({ balance, transferGas, gasPrice }) =>
										this.transferNative({
											from: wallet,
											to: mainAddress,
											amount:
												balance -
												transferGas * gasPrice -
												bigint_percent(transferGas * gasPrice, 95)
										})
									),
									Effect.tap(() => Effect.log("done with draw native"))
								)
						})
					)
				)
			),
			Effect.all,
			Effect.asVoid
		)
	}
}

function percent(value: number, percent: number) {
	return (value / 100) * percent
}

function bigint_percent(value: bigint, percent: number) {
	return (value / 100n) * BigInt(percent)
}
