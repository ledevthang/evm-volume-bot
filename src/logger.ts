import { DateTime } from "luxon"

export class Logger {
	public info(...args: unknown[]) {
		console.info(
			`[INFO] [${DateTime.now().toFormat("yyyy/mm/dd HH:MM:ss")}]`,
			...args
		)
	}

	public error(...args: unknown[]) {
		console.error(
			`[ERROR] [${DateTime.now().toFormat("yyyy/mm/dd HH:MM:ss")}]`,
			...args
		)
	}
}
