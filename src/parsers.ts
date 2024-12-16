import { isAddress } from "viem"
import { z } from "zod"

export const evmAddress = () =>
	z
		.string()
		.transform(str => str.trim().toLowerCase())
		.refine(isAddress, "invalid ethereum address")

export const notEmptyStr = () =>
	z
		.string()
		.min(1)
		.transform(str => str.trim())

export const positiveNumber = () => z.number().positive()
