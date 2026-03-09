/**
 * Commit Classifier - Pure functions for classifying git commits
 *
 * Determines whether a commit flowed through Surface Protocol or bypassed it.
 * No I/O, no external deps beyond types.
 */

import type {
	BypassCategory,
	ClassifiedCommit,
	CommitClassification,
	RoutedSignal,
} from "./types.js";

// =============================================================================
// Parsing
// =============================================================================

/**
 * Parse a git log line in `hash|author|date|subject` format.
 */
export function parseCommitLine(line: string): {
	hash: string;
	author: string;
	date: string;
	subject: string;
} | null {
	const parts = line.split("|");
	const [hash, author, date, ...rest] = parts;
	if (!hash || !author || !date || rest.length === 0) return null;
	return {
		hash,
		author,
		date,
		subject: rest.join("|"),
	};
}

/**
 * Extract type, scope, and summary from a conventional commit subject.
 */
export function parseConventionalCommit(subject: string): {
	type: string;
	scope: string;
	summary: string;
} {
	const match = subject.match(/^(?<type>\w+)(?:\((?<scope>[^)]*)\))?!?:\s*(?<summary>.*)$/);
	if (!match?.groups) {
		return { type: "", scope: "", summary: subject };
	}
	return {
		type: match.groups.type ?? "",
		scope: match.groups.scope ?? "",
		summary: match.groups.summary ?? "",
	};
}

// =============================================================================
// Trailer / Signal Extraction
// =============================================================================

const TRAILER_RE = /^Surface-Protocol:\s*(\S+)/m;

/**
 * Find `Surface-Protocol: <value>` trailer in commit body.
 */
export function extractSurfaceTrailer(body: string): RoutedSignal | null {
	const match = body.match(TRAILER_RE);
	if (!match?.[1]) return null;
	const value = match[1].toLowerCase();
	switch (value) {
		case "capture":
			return "trailer-capture";
		case "implement":
			return "trailer-implement";
		case "ship":
			return "trailer-ship";
		case "quickfix":
			return "trailer-quickfix";
		case "problem":
			return "trailer-problem";
		default:
			return "heuristic";
	}
}

// =============================================================================
// Classification
// =============================================================================

const ID_PREFIXES = "REQ|FLOW|REGR|CONTRACT|SEC|NFR|SMOKE|FUNC";
const REQ_ID_RE = new RegExp(`\\b(${ID_PREFIXES})-\\d+`);
const AFFECTS_RE = new RegExp(`^Affects:\\s*.*(${ID_PREFIXES})-`, "m");

/**
 * Classify a commit using the priority chain:
 * 1. Surface-Protocol trailer in body (definitive)
 * 2. Affects: REQ-* etc. in body
 * 3. REQ-/FLOW- etc. ID in subject
 * 4. Fall through to bypass
 */
export function classifyCommit(
	subject: string,
	body: string,
): {
	classification: CommitClassification;
	signal: RoutedSignal | null;
	bypass_category: BypassCategory | null;
} {
	// 1. Trailer in body
	const trailer = extractSurfaceTrailer(body);
	if (trailer) {
		return { classification: "surface-routed", signal: trailer, bypass_category: null };
	}

	// 2. Affects: trailer with requirement IDs
	if (AFFECTS_RE.test(body)) {
		return { classification: "surface-routed", signal: "affects-trailer", bypass_category: null };
	}

	// 3. REQ-/FLOW- etc. ID in subject
	if (REQ_ID_RE.test(subject)) {
		return { classification: "surface-routed", signal: "req-id-in-subject", bypass_category: null };
	}

	// 4. Bypass
	const { type } = parseConventionalCommit(subject);
	return {
		classification: "bypass",
		signal: null,
		bypass_category: categorizeBypass(type),
	};
}

/**
 * Map a conventional commit type to a bypass category.
 */
export function categorizeBypass(type: string): BypassCategory {
	switch (type) {
		case "ci":
		case "build":
			return "ci-infra";
		case "docs":
			return "docs";
		case "chore":
		case "style":
		case "refactor":
		case "perf":
			return "config";
		case "test":
		case "spec":
			return "test";
		default:
			return "unknown";
	}
}

// =============================================================================
// Full Classification
// =============================================================================

/**
 * Build a fully classified commit from parsed data.
 */
export function buildClassifiedCommit(
	hash: string,
	author: string,
	date: string,
	subject: string,
	body: string,
): ClassifiedCommit {
	const { type, scope, summary } = parseConventionalCommit(subject);
	const { classification, signal, bypass_category } = classifyCommit(subject, body);

	return {
		hash,
		author,
		date,
		type,
		scope,
		summary,
		classification,
		signal,
		bypass_category,
	};
}
