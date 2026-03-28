/**
 * Safe child process execution helper.
 *
 * Uses execFile (not exec) to prevent shell injection — arguments are passed
 * as an array and never interpolated into a shell string.
 *
 * Returns structured output instead of throwing on non-zero exit.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ExecResult {
	stdout: string;
	stderr: string;
	status: number; // 0 = success, non-zero = failure
}

/**
 * Run a command with array arguments. Never throws — returns status code instead.
 *
 * @param cmd   - The command to run (e.g. "git")
 * @param args  - Arguments as an array (e.g. ["log", "--oneline"])
 * @param cwd   - Working directory
 */
export async function execFileNoThrow(
	cmd: string,
	args: string[],
	cwd?: string,
): Promise<ExecResult> {
	try {
		const { stdout, stderr } = await execFileAsync(cmd, args, {
			cwd,
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024, // 10 MB
		});
		return { stdout: stdout ?? "", stderr: stderr ?? "", status: 0 };
	} catch (err) {
		if (isExecError(err)) {
			return {
				stdout: err.stdout ?? "",
				stderr: err.stderr ?? "",
				status: err.code ?? 1,
			};
		}
		return { stdout: "", stderr: String(err), status: 1 };
	}
}

interface ExecError extends Error {
	stdout?: string;
	stderr?: string;
	code?: number;
}

function isExecError(err: unknown): err is ExecError {
	return err instanceof Error;
}
