import type { DateTime } from "luxon"
import type { Address, Hex } from "viem"
import crypto from "node:crypto"

type Wallet = {
	address: Address
	privateKey: Hex
	createdAt: DateTime
}

const key = crypto
	.createHash("sha256")
	.update(process.env.HASH_SECRET!)
	.digest("hex")
	.slice(0, 32)

const iv = crypto
	.createHash("md5")
	.update(process.env.HASH_SECRET!)
	.digest("hex")
	.slice(0, 16)

export function encryptWallet(wallet: Wallet) {
	const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)

	const data = JSON.stringify({
		address: wallet.address,
		privateKey: wallet.privateKey,
		createdAt: wallet.createdAt.toISO()
	})

	let encrypted = cipher.update(data, "utf8", "hex")

	encrypted += cipher.final("hex")

	return encrypted
}

export function decryptWallet(encryptedData: string): Wallet {
	const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
	let decrypted = decipher.update(encryptedData, "hex", "utf8")

	decrypted += decipher.final("utf8")

	return JSON.parse(decrypted)
}
