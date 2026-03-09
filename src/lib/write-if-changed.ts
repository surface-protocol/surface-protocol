/**
 * Write-if-changed utility
 *
 * Prevents noisy git diffs by only writing files when actual content
 * (ignoring timestamps) has changed. Generated timestamps like
 * "generated": "2026-..." or "> Generated: ..." are stripped before
 * comparison so a fresh Date alone never triggers a write.
 */

import { readFile, writeFile } from "node:fs/promises";

const TIMESTAMP_LINE_RE = /^(\s*"generated":\s*".*"|> Generated:.*|"generated":.*)/gm;

/**
 * Strip timestamp lines so two files differing only by generated date
 * compare as equal.
 */
export function stripTimestamps(content: string): string {
	return content.replace(TIMESTAMP_LINE_RE, "");
}

/**
 * Write a file only if its non-timestamp content has changed.
 * Returns true if the file was written, false if skipped.
 */
export async function writeIfContentChanged(
	filePath: string,
	newContent: string,
): Promise<boolean> {
	try {
		const existing = await readFile(filePath, "utf-8");
		if (stripTimestamps(existing) === stripTimestamps(newContent)) return false;
	} catch {
		/* File doesn't exist yet — write it */
	}
	await writeFile(filePath, newContent);
	return true;
}
