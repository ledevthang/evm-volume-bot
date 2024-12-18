import fs from "node:fs"
import { decryptWallet } from "./hashing.js"
import { decryptedFilePath, encryptedFilePath } from "./parse-config.js"

function main() {
	const encryptedLines = fs
		.readFileSync(encryptedFilePath, "utf8")
		.split("\n")
		.filter(Boolean)

	const wallets = encryptedLines.map(decryptWallet)

	fs.writeFileSync(decryptedFilePath, JSON.stringify(wallets, null, 1), "utf-8")
}

main()
