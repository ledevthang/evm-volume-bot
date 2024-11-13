import dotenv from 'dotenv';
import { Address, Hex, createPublicClient, createWalletClient, hexToBytes, http, isBytes, parseEther, parseUnits, stringToBytes, toHex } from 'viem'
import { bscTestnet, mainnet } from 'viem/chains'
import { privateKeyToAccount, sign, signMessage } from 'viem/accounts';
import { encodePacked } from 'viem'
import { keccak256 } from 'viem'
import { hashMessage } from 'viem/utils';
import { parseSignature } from 'viem'
import { toBytes } from 'viem'
import { defineChain } from 'viem'
import { Contract, Wallet, ethers, getBytes, solidityPacked, solidityPackedKeccak256, toUtf8Bytes } from "ethers";
import { Web3 } from 'web3';
import fetch from 'node-fetch';
import yesno from 'yesno';
import axios from "axios";
import { getAllowance, getApproval, getSwap } from './helper';

dotenv.config();

const chainId = 43114; // Chain ID for AVAX
const web3RpcUrl = "wss://avalanche-c-chain-rpc.publicnode.com"; // URL for BSC node
const walletAddress = "0xf58910f0dd17D70b4D8E65e64B1cE528EFb4A2e5"; // Your wallet address

const broadcastApiUrl = "https://api.1inch.dev/tx-gateway/v1.1/" + chainId + "/broadcast";
const apiBaseUrl = "https://api.1inch.dev/swap/v6.0/" + chainId;
const web3 = new Web3(web3RpcUrl);
const wallet = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY as string);

const headers = { headers: { Authorization: `Bearer ${process.env.API_1INCH_KEY}`, accept: "application/json" } };

function apiRequestUrl(methodName: any, queryParams: any) {
  return apiBaseUrl + methodName + "?" + new URLSearchParams(queryParams).toString();
}

// Post raw transaction to the API and return transaction hash
async function broadCastRawTransaction(rawTransaction: any) {
  console.log("rawTransaction", rawTransaction);
  console.log("headers.headers", headers.headers);

  const broadcast = await axios.post(broadcastApiUrl,
    { rawTransaction }
    ,
    {
      headers: { accept: 'application/json', Authorization: `Bearer ${process.env.API_1INCH_KEY}` }
    });

  return broadcast.data

  // return fetch(broadcastApiUrl, {
  //   method: "post",
  //   body: JSON.stringify({ rawTransaction }),
  //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.API_1INCH_KEY}` }
  // })
  //   .then((res) => res.json())
  //   .then((res) => {
  //     return res.transactionHash;
  //   });
}

// Sign and post a transaction, return its hash
async function signAndSendTransaction(transaction: any) {
  const { rawTransaction } = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY as string);
  console.log(rawTransaction);

  return await broadCastRawTransaction(rawTransaction);
}

const swapParams = {
  src: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Token address of AVAX
  dst: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // Token address of WAVAX
  amount: "10000000000000000", // Amount of AVAX to swap (in wei)
  from: walletAddress,
  slippage: 1, // Maximum acceptable slippage percentage for the swap (e.g., 1 for 1%)
  includeProtocols: true,
  disableEstimate: false, // Set to true to disable estimation of swap details
  allowPartialFill: false // Set to true to allow partial filling of the swap order
};

const allowanceParam = {
  tokenAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  walletAddress: walletAddress
}

const approvalParam = {
  tokenAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  amount: "10000000000000000"
}

const params = {
  "src": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "dst": "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
  "amount": "10000000000000000",
  "from": "0xf58910f0dd17D70b4D8E65e64B1cE528EFb4A2e5",
  "origin": "0xf58910f0dd17D70b4D8E65e64B1cE528EFb4A2e5",
  "slippage": "1",
  "includeProtocols": "true",
  "includeGas": "true"
}


async function main() {
  // Passing in the eth or web3 package is necessary to allow retrieving chainId, gasPrice and nonce automatically
  // for accounts.signTransaction().
  // const account = web3.eth.accounts.create();
  // console.log(account);

  // const allowanceUrl = apiRequestUrl("/approve/allowance", allowanceParam);
  // const allowance = await getAllowance(allowanceUrl);
  // console.log(allowance);

  // const approvalUrl = apiRequestUrl("/approve/transaction", approvalParam);
  // const approval = await getApproval(approvalUrl);
  // console.log(approval);

  // const swapUrl = apiRequestUrl("/swap", params);
  // const swapData = await getSwap(swapUrl);
  // console.log(swapData);

  await approve(swapParams.dst);
  await swap(swapParams);

  // const transactionForSign = await buildTxForApproveTradeWithRouter(swapParams.dst);
  // console.log("Transaction for approve: ", transactionForSign);

  // const approveTxHash = await signAndSendTransaction(transactionForSign);
  // console.log("Approve tx hash: ", approveTxHash);

  // const swapTransaction = await buildTxForSwap(swapParams);
  // console.log("Transaction for swap: ", swapTransaction);

  // const swapTxHash = await signAndSendTransaction(swapTransaction);
  // console.log("Swap tx hash: ", swapTxHash);
}

async function approve(tokenAddress: any, amount?: any) {
  try {
    const url = apiRequestUrl("/approve/transaction", amount ? { tokenAddress, amount } : { tokenAddress });

    const transaction = await fetch(url, headers).then((res) => res.json());

    const gasLimit = await web3.eth.estimateGas({
      ...transaction,
      from: walletAddress
    });
    console.log(gasLimit);

    const data = {
      ...transaction,
      gas: gasLimit,
      nonce: await web3.eth.getTransactionCount(walletAddress)
    }

    console.log(data);

    // Sign transaction with PK
    const createTransaction = await web3.eth.accounts.signTransaction(data, process.env.PRIVATE_KEY as string);
    console.log(createTransaction.rawTransaction);

    // Send transaction and wait for receipt
    const tx = await web3.eth.sendSignedTransaction(createTransaction.rawTransaction);

    if (tx.status) {
      console.log("tx for approve", tx);
      console.log("approve success!");
    } else {
      console.log("tx for approve", tx);
      console.log("approve unsuccess!");
    }
  } catch (err) {
    console.log("ERROR", err);
  }
}

async function swap(swapParams: any) {
  try {
    const url = apiRequestUrl("/swap", swapParams);

    // Fetch the swap transaction details from the API
    const response = await fetch(url, headers)
      .then((res) => res.json())
      .then((res) => res.tx);
    console.log(response);

    const tx = await web3.eth.sendTransaction(response);
    if (tx.status) {
      console.log("tx for swap", tx);
      console.log("swap success!");
    } else {
      console.log("tx for swap", tx);
      console.log("swap unsuccess!");
    }
  } catch (err) {
    console.log("ERROR", err);

  }
}

async function buildTxForApproveTradeWithRouter(tokenAddress: any, amount?: any) {
  const url = apiRequestUrl("/approve/transaction", amount ? { tokenAddress, amount } : { tokenAddress });

  const transaction = await fetch(url, headers).then((res) => res.json());

  const gasLimit = await web3.eth.estimateGas({
    ...transaction,
    from: walletAddress
  });

  return {
    ...transaction,
    gas: gasLimit,
    nonce: await web3.eth.getTransactionCount(walletAddress)
  };
}

async function buildTxForSwap(swapParams: any) {
  const url = apiRequestUrl("/swap", swapParams);

  // Fetch the swap transaction details from the API
  return fetch(url, headers)
    .then((res) => res.json())
    .then((res) => res.tx);
}

main();


