import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { Web3 } from 'web3';
dotenv.config();

const chainId = 43114;
const web3RpcUrl = "https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc"; // URL for BSC node
const web3 = new Web3(web3RpcUrl);
const headers = { headers: { Authorization: `Bearer ${process.env.API_1INCH_KEY}`, accept: "application/json" } };
const broadcastApiUrl = "https://api.1inch.dev/tx-gateway/v1.1/" + chainId + "/broadcast";

async function getAllowance(url: any) {
  const allowanceResponse = await fetch(url, headers);
  const data = await allowanceResponse.json();
  return data;
}

async function getApproval(url: any) {
  const approvalResponse = await fetch(url, {
    method: "GET",
    headers: headers.headers
  }).then((res) => res.json());
  // const data = await approvalRespone.json();
  return approvalResponse;
}

async function getSwap(url: any) {
  const response = await fetch(url, {
    method: "GET",
    headers: headers.headers
  });
  const data = await response.json();
  return data;
}

export { getAllowance, getApproval, getSwap }