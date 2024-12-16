import type { DateTime } from "luxon"
import type { Address, Hex } from "viem"
import crypto from "node:crypto"

type Wallet = {
	address: Address
	privateKey: Hex
	createdAt: DateTime
}

export function encryptWallet(wallet: Wallet) {
	const cipher = crypto.createCipheriv(
		"aes-256-cbc",
		Buffer.from(process.env.ENCRYPTION_KEY!, "hex"),
		Buffer.from(process.env.IV!, "hex")
	)

	const data = JSON.stringify({
		address: wallet.address,
		privateKey: wallet.privateKey,
		createdAt: wallet.createdAt.toISO()
	})

	let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex")

	encrypted += cipher.final("hex")

	return encrypted
}

export function decryptWallet(encryptedData: string): Wallet {
	const decipher = crypto.createDecipheriv(
		"aes-256-cbc",
		Buffer.from(process.env.ENCRYPTION_KEY!, "hex"),
		Buffer.from(process.env.IV!, "hex")
	)
	let decrypted = decipher.update(encryptedData, "hex", "utf8")

	decrypted += decipher.final("utf8")

	return JSON.parse(decrypted)
}
