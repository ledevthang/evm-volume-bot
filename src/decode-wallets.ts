import fs from "node:fs"
import { decryptWallet } from "./hashing.js"

function main() {
	const encryptedLines = fs
		.readFileSync("evm-wallets.txt", "utf8")
		.split("\n")
		.filter(Boolean)

	const wallets = encryptedLines.map(decryptWallet)

	fs.writeFileSync(
		"evm-decoded-wallets.txt",
		JSON.stringify(wallets, null, 1),
		"utf-8"
	)
}

main()
