// import dotenv from "dotenv"
// import fetch from "node-fetch"
// import { Web3 } from "web3"
// dotenv.config()

// const chainId = 43114 // Chain ID for AVAX
// const web3RpcUrl = "wss://avalanche-c-chain-rpc.publicnode.com" // URL for BSC node
// const walletAddress = "0xf58910f0dd17D70b4D8E65e64B1cE528EFb4A2e5" // Your wallet address

// const broadcastApiUrl =
// 	"https://api.1inch.dev/tx-gateway/v1.1/" + chainId + "/broadcast"
// const apiBaseUrl = "https://api.1inch.dev/swap/v6.0/" + chainId
// const web3 = new Web3(web3RpcUrl)
// const wallet = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY as string)

// const headers = {
// 	headers: {
// 		Authorization: `Bearer ${process.env.API_1INCH_KEY}`,
// 		accept: "application/json"
// 	}
// }

// function apiRequestUrl(methodName: any, queryParams: any) {
// 	return (
// 		apiBaseUrl + methodName + "?" + new URLSearchParams(queryParams).toString()
// 	)
// }
// //0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
// const swapParams = {
// 	src: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // Token address of AVAX
// 	dst: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Token address of WAVAX
// 	amount: "10000000000000000", // Amount of AVAX to swap (in wei)
// 	from: wallet[0].address,
// 	slippage: 1, // Maximum acceptable slippage percentage for the swap (e.g., 1 for 1%)
// 	includeProtocols: true,
// 	disableEstimate: false, // Set to true to disable estimation of swap details
// 	allowPartialFill: false // Set to true to allow partial filling of the swap order
// }

// async function main() {
// 	// Passing in the eth or web3 package is necessary to allow retrieving chainId, gasPrice and nonce automatically
// 	// for accounts.signTransaction().
// 	// const account = web3.eth.accounts.create();
// 	// console.log(account);

// 	await approve(swapParams.dst)
// 	await swap(swapParams)
// }

// async function approve(tokenAddress: any, amount?: any) {
// 	try {
// 		const url = apiRequestUrl(
// 			"/approve/transaction",
// 			amount ? { tokenAddress, amount } : { tokenAddress }
// 		)

// 		const transaction = await fetch(url, headers).then(res => res.json())

// 		const gasLimit = await web3.eth.estimateGas({
// 			...transaction,
// 			from: wallet[0].address
// 		})
// 		console.log(gasLimit)

// 		const data = {
// 			...transaction,
// 			gas: gasLimit,
// 			nonce: await web3.eth.getTransactionCount(wallet[0].address)
// 		}

// 		console.log(data)

// 		// Sign transaction with PK
// 		const createTransaction = await web3.eth.accounts.signTransaction(
// 			data,
// 			process.env.PRIVATE_KEY as string
// 		)
// 		console.log(createTransaction.rawTransaction)

// 		// Send transaction and wait for receipt
// 		const tx = await web3.eth.sendSignedTransaction(
// 			createTransaction.rawTransaction
// 		)

// 		if (tx.status) {
// 			console.log("tx for approve", tx)
// 			console.log("approve success!")
// 		} else {
// 			console.log("tx for approve", tx)
// 			console.log("approve unsuccess!")
// 		}
// 	} catch (err) {
// 		console.log("ERROR", err)
// 	}
// }

// async function swap(swapParams: any) {
// 	try {
// 		const url = apiRequestUrl("/swap", swapParams)

// 		// Fetch the swap transaction details from the API
// 		const response = await fetch(url, headers)
// 			.then(res => res.json())
// 			.then(res => res.tx)
// 		console.log(response)

// 		const tx = await web3.eth.sendTransaction(response)
// 		if (tx.status) {
// 			console.log("tx for swap", tx)
// 			console.log("swap success!")
// 		} else {
// 			console.log("tx for swap", tx)
// 			console.log("swap unsuccess!")
// 		}
// 	} catch (err) {
// 		console.log("ERROR", err)
// 	}
// }

// main()
