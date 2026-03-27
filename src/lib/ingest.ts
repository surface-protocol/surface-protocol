/**
 * Ingestion Pipeline
 *
 * Library functions for capturing requirements, persisting learnings,
 * and archiving requirements. These are the building blocks that
 * plugin skills and CLI commands compose together.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { getAdapter } from "./adapters/adapter.js";
import { loadConfig } from "./config.js";
import { findTestFiles } from "./parser.js";
import type { CaptureInput, LearnInput } from "./types.js";

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

async function ensureParentDir(path: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
}

/**
 * Read the current ID counter and return the next requirement ID.
 */
async function nextRequirementId(dir: string, prefix: string): Promise<string> {
	const counterPath = join(dir, ".surface/state/id-counter");
	let counter = 0;
	try {
		const content = await readFile(counterPath, "utf-8");
		counter = Number.parseInt(content.trim(), 10) || 0;
	} catch {
		// Counter file doesn't exist yet — start at 0
	}
	counter++;
	await ensureParentDir(counterPath);
	await writeFile(counterPath, `${counter}\n`, "utf-8");
	return `${prefix}-${String(counter).padStart(3, "0")}`;
}

/**
 * Allocate N requirement IDs atomically from the shared counter.
 * Used by `surface backfill` to batch-allocate IDs before injecting them.
 */
export async function allocateRequirementIds(
	dir: string,
	prefix: string,
	count: number,
): Promise<string[]> {
	if (count <= 0) return [];
	const counterPath = join(dir, ".surface/state/id-counter");
	let counter = 0;
	try {
		const content = await readFile(counterPath, "utf-8");
		counter = Number.parseInt(content.trim(), 10) || 0;
	} catch {
		// Counter file doesn't exist yet — start at 0
	}
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		counter++;
		ids.push(`${prefix}-${String(counter).padStart(3, "0")}`);
	}
	await ensureParentDir(counterPath);
	await writeFile(counterPath, `${counter}\n`, "utf-8");
	return ids;
}

/**
 * Capture a new requirement: create a normalized source doc and a test stub.
 *
 * Returns the assigned ID, the path to the test stub, and the path to the source doc.
 */
export async function captureRequirement(input: CaptureInput): Promise<{
	id: string;
	stubPath: string;
	sourcePath: string;
}> {
	const config = await loadConfig(input.dir);
	const adapter = getAdapter(config.adapter);
	if (!adapter) {
		throw new Error(`Unknown adapter: ${config.adapter}`);
	}

	const id = await nextRequirementId(input.dir, config.idPrefixes.requirement);
	const date = new Date().toISOString().slice(0, 10);
	const sourceSlug = slugify(`${id}-${input.summary}`);
	const sourceDir = join(input.dir, ".surface/sources", input.sourceKind);
	const sourcePath = join(sourceDir, `${sourceSlug}.md`);

	const normalizedSource = [
		`# ${id}: ${input.summary}`,
		"",
		`- Source kind: ${input.sourceKind}`,
		`- Source ref: ${input.sourceRef}`,
		input.sourceUrl ? `- Source url: ${input.sourceUrl}` : undefined,
		input.area ? `- Area: ${input.area}` : undefined,
		"",
		"## Acceptance",
		...input.acceptance.map((criterion) => `- ${criterion}`),
	]
		.filter(Boolean)
		.join("\n");

	await mkdir(sourceDir, { recursive: true });
	await writeFile(sourcePath, `${normalizedSource}\n`, "utf-8");

	const stub = adapter.renderStub({
		id,
		summary: input.summary,
		area: input.area,
		acceptance: input.acceptance,
		source: {
			type: input.sourceKind,
			ref: `${input.sourceKind}/${sourceSlug}.md`,
			url: input.sourceUrl,
		},
		date,
		kind: input.kind ?? "capture",
	});

	const stubPath = resolve(input.dir, stub.filePath);
	await ensureParentDir(stubPath);
	await writeFile(stubPath, stub.content, "utf-8");

	return { id, stubPath, sourcePath };
}

/**
 * Persist a learning from a debugging session or thread.
 *
 * Returns the path to the created learning file.
 */
export async function persistLearning(input: LearnInput): Promise<string> {
	const dir = join(input.dir, ".surface/learnings");
	await mkdir(dir, { recursive: true });
	const slug = input.fileName ?? slugify(input.title);
	const path = join(dir, `${slug}.md`);
	const content = [
		`# ${input.title}`,
		"",
		`- Source kind: ${input.sourceKind ?? "thread"}`,
		input.sourceRef ? `- Source ref: ${input.sourceRef}` : undefined,
		"",
		input.summary,
		"",
		"## Durable Learnings",
		...(input.insights?.map((insight) => `- ${insight}`) ?? [
			"- Add the real learnings here before you call it done.",
		]),
	]
		.filter(Boolean)
		.join("\n");
	await writeFile(path, `${content}\n`, "utf-8");
	return path;
}

/**
 * Archive a requirement by setting its status to "archived" in the test file.
 *
 * Returns the path to the modified file, or null if the requirement was not found.
 */
export async function archiveRequirement(dir: string, id: string): Promise<string | null> {
	const config = await loadConfig(dir);
	const adapter = getAdapter(config.adapter);
	const files = findTestFiles(dir, adapter?.filePatterns);

	for (const file of files) {
		const content = await readFile(file, "utf-8");
		if (!content.includes(id)) continue;

		const nextContent = content.includes("status: archived")
			? content
			: content.replace(
					/status:\s*(pending|implemented|active|deprecated|consolidated)/,
					"status: archived",
				);
		if (nextContent !== content) {
			await writeFile(file, nextContent, "utf-8");
			return file;
		}
	}

	return null;
}
