# Install Nodejs version 20 or above ( https://nodejs.org/en/download/package-manager )

# Install dependencies 
- In the bot folder run these following scripts ( for first time )
 $ npm install -g pnpm
 $ pnpm install
 $ pnpm release

# Configure the bot
- In the bot folder create .env file with your configuration

   # Requirement
   + PRIVATE_KEY ( private key of main wallet address )
   + API_1INCH_KEY ( 1inch Api key )
   + RPC_1 ( RPC url )
   + RPC_2 ( anothor RPC url )
   
   # Config
   + CHAIN ( avax or ether )
   + TOKEN_ADDRESS ( the token's address )
   + INIT_FEE ( The amount of native token that main wallet will transfer to each sub wallet for first time )
   + INIT_TOKEN ( The amount of token that main wallet will transfer to each sub wallet for first time )
   + SUB_ACCOUNT_CONCURRENCY ( Number of wallets transacting simultaneously )
   + SUB_ACCOUNT_TRADING_MAX ( Limit the number of transactions of a sub-wallet )
   
Sample Configuration: 
	# Main account
	PRIVATE_KEY=

	# 1Inch 
	API_1INCH_KEY=

	# Rpc
	RPC_1=https://avalanche.drpc.org
	RPC_2=https://avax-mainnet.g.alchemy.com/v2/api-key

	# Config
	CHAIN=avax
	INIT_FEE=0.01
	INIT_TOKEN=0.001
	SUB_ACCOUNT_CONCURRENCY=3
	SUB_ACCOUNT_TRADING_MAX=6
	TOKEN_ADDRESS=0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7 # address of WAVAX

# Running bot
- In the bot folder run this script:
 $ node --env-file=.env dist/main.js
 
# Informations file
- wallets.txt ( The file where the bot writes the generated wallets )
- executing-wallets.txt ( The file where the bot writes the wallets in trading process )

# Withdraw from subwallets to main wallet
- In the bot folder run this script:
 $ node --env-file=.env dist/withdraw.js