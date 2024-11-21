// add "type": "module" to your package.json to run this with node or name the file with extension .mjs to prevent writing existing .js files
import { LimitOrder, MakerTraits, Address } from "@1inch/limit-order-sdk";
import { Wallet, JsonRpcProvider, Contract } from 'ethers';
import { Api, getLimitOrderV4Domain } from "@1inch/limit-order-sdk";
// import { AxiosProviderConnector } from "@1inch/limit-order-sdk/axios";

import { AxiosProviderConnector } from "./AxiosProviderConnector";

import dotenv from 'dotenv';
dotenv.config();
// ERC20 Token standard ABI for the approve function
const erc20AbiFragment = [
  "function approve(address spender, uint256 amount) external returns (bool)"
];

(async () => {
  // it is a well-known test private key, do not use it in production
  const chainId = 43114; // Chain ID for AVAX
  const headers = { headers: { Authorization: `Bearer ${process.env.API_1INCH_KEY}`, accept: "application/json, text/plain, */*" } };
  const maker = new Wallet(process.env.PRIVATE_KEY as string);
  const expiresIn = 120n // 2m
  const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn

  const makerAsset = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"; // WAVAX
  const makingAmount = 100000000000000000n;

  //Orders must call the approve function prior to being submitted
  // Initialize ethers provider
  const provider = new JsonRpcProvider("https://avax-mainnet.g.alchemy.com/v2/cw-iL0LU4fvVloJM_i-Mak37uN--ZL7g");
  const makerWallet = maker.connect(provider);

  // Approve the makerAsset contract to spend on behalf of the maker
  const makerAssetContract = new Contract(makerAsset, erc20AbiFragment, makerWallet);
  const domain: any = getLimitOrderV4Domain(chainId);

  // console.log('Approving makerAsset spend...', domain.verifyingContract, makerAsset);
  try {
    const approveTx = await makerAssetContract.approve(domain.verifyingContract, makingAmount);
    await approveTx.wait(); // Wait for the transaction to be mined
    console.log('Approval successful');
  } catch (error) {
    console.error('Error in approving makerAsset spend:', error);
    return { success: false, reason: "Failed to approve makerAsset spend." };
  }

  // see MakerTraits.ts
  const makerTraits = MakerTraits.default()
    .withExpiration(expiration)
    .allowPartialFills() // If you wish to allow partial fills
    .allowMultipleFills(); // And assuming multiple fills are also okay

  const order = new LimitOrder({
    makerAsset: new Address('0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'),
    takerAsset: new Address('0xd586e7f844cea2f87f50152665bcbc2c279d8d70'), //1INCH
    makingAmount: 100000000000000000n,
    takingAmount: 354591303896920600n,
    maker: new Address(maker.address),
    salt: BigInt(Math.floor(Math.random() * 100000000)),
    receiver: new Address(maker.address),
  }, makerTraits)

  const typedData = order.getTypedData(domain)
  const converted = { ...typedData.domain, chainId: chainId } // convert chainId to string, because ethers wants a bignumberish value
  const signature = await maker.signTypedData(
    converted,
    { Order: typedData.types.Order },
    typedData.message
  )

  const api = new Api({
    networkId: chainId,
    authKey: String(process.env.API_1INCH_KEY), // get it at https://portal.1inch.dev/
    httpConnector: new AxiosProviderConnector()
  });

  // // submit order 
  try {
    // @1inch/limit-order-sdk/dist/api/api.js, must edit the `submitOrder` method to return the promise
    let result = await api.submitOrder(order, signature);
    console.log('result', result);
  } catch (e) {
    console.log(e);
  }

  // get order by hash
  const hash = order.getOrderHash(chainId)
  console.log(hash);

  // // must wait at least 1.05 seconds after submitting the order to query it
  await new Promise(resolve => setTimeout(resolve, 2050));

  const orderInfo = await api.getOrderByHash(hash);
  console.log('orderInfo', orderInfo);

})();