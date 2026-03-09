/**
 * Implementation Status Detection
 *
 * Detects the implementation state of test cases by analyzing:
 * - YAML metadata (status: pending)
 * - Test function syntax (it.todo(), it.skip())
 * - Test body patterns (throw NOT IMPLEMENTED)
 * - Assertion presence (expect, assert calls)
 *
 * Detection priority (highest to lowest):
 * 1. Explicit YAML status: pending
 * 2. it.todo() syntax
 * 3. it.skip() syntax
 * 4. Body pattern matching for NOT IMPLEMENTED
 * 5. No assertions = stub
 * 6. Has assertions = complete
 */

/** Lines of content to analyze for implementation status detection */
const DETECTION_WINDOW_LINES = 300;
/** Lines of content to analyze for acceptance criteria coverage (larger to capture all test blocks) */
const ACCEPTANCE_WINDOW_LINES = 500;

import type {
	ImplementationState,
	ImplementationStatus,
	LifecycleStage,
	LifecycleStatus,
	ParsedTest,
	Requirement,
	TestMetadata,
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

/**
 * Patterns that indicate a test is not yet implemented.
 * These are matched case-insensitively against the test body.
 */
const NOT_IMPLEMENTED_PATTERNS = [
	/throw\s+new\s+Error\s*\(\s*['"`]NOT\s+IMPLEMENTED['"`]\s*\)/i,
	/throw\s+new\s+Error\s*\(\s*['"`]TODO['"`]\s*\)/i,
	/throw\s+new\s+Error\s*\(\s*['"`]FIXME['"`]\s*\)/i,
	/throw\s+['"`]NOT\s+IMPLEMENTED['"`]/i,
	/throw\s+['"`]TODO['"`]/i,
	// Vitest specific
	/expect\.fail\s*\(\s*['"`]NOT\s+IMPLEMENTED['"`]\s*\)/i,
	/expect\.fail\s*\(\s*['"`]TODO['"`]\s*\)/i,
];

/**
 * Patterns that indicate assertions exist in the test body.
 * If any of these are found, the test is considered to have implementation.
 */
const ASSERTION_PATTERNS = [
	// Vitest/Jest expect
	/expect\s*\(/,
	/expect\.\w+\s*\(/,
	// Chai-style
	/assert\s*\.\w+\s*\(/,
	/should\s*\.\w+/,
	// Node.js assert
	/assert\s*\(/,
	/assert\.strict/,
	/assert\.deepEqual/,
	/assert\.equal/,
	/assert\.ok/,
	/assert\.throws/,
	/assert\.rejects/,
	// Vitest-specific matchers
	/\.toBe\s*\(/,
	/\.toEqual\s*\(/,
	/\.toMatchSnapshot\s*\(/,
	/\.toThrow\s*\(/,
	/\.toHaveBeenCalled/,
	/\.toHaveProperty\s*\(/,
	/\.toContain\s*\(/,
	/\.toBeTruthy\s*\(/,
	/\.toBeFalsy\s*\(/,
	/\.toBeNull\s*\(/,
	/\.toBeDefined\s*\(/,
	/\.toBeUndefined\s*\(/,
	/\.toMatch\s*\(/,
];

/**
 * Regex to match it.todo() syntax.
 * Matches: it.todo('test name'), it.todo("test name"), it.todo(`test name`)
 */
const IT_TODO_REGEX = /(?:^|\s)(?:it|test)\.todo\s*\(\s*['"`]/;

/**
 * Regex to match it.skip() syntax.
 * Matches: it.skip('test name'), test.skip("test name"), etc.
 */
const IT_SKIP_REGEX = /(?:^|\s)(?:it|test)\.skip\s*\(\s*['"`]/;

/**
 * Regex to match describe.skip() syntax.
 * When a describe block is skipped, all tests inside are skipped.
 */
const DESCRIBE_SKIP_REGEX = /(?:^|\s)describe\.skip\s*\(\s*['"`]/;

/**
 * Regex to match Playwright's conditional test.skip(condition, reason) syntax.
 * Unlike Vitest's test.skip('name', callback), Playwright's conditional skip
 * takes a non-string first argument: test.skip(true, "reason").
 * When called inside test.describe(), it skips ALL tests in that block.
 * Matches: test.skip(true, ...), test.skip(false, ...), test.skip(someVar, ...)
 * Does NOT match: test.skip('test name', ...) — that's the Vitest/Jest pattern.
 *
 * Uses ^ with multiline flag so it only matches test.skip at the start of a line
 * (after optional whitespace). This prevents false positives from test.skip(true, ...)
 * appearing inside string literals in test data/fixtures.
 */
const PLAYWRIGHT_CONDITIONAL_SKIP_REGEX = /^\s*(?:it|test)\.skip\s*\(\s*(?!['"`])/m;

/**
 * Regex to extract test body content.
 * Matches the function body after `it('name', ...)` or `test('name', ...)`
 * This is a simplified extraction - for complex cases we may need proper AST parsing.
 */
const TEST_BODY_REGEX =
	/(?:it|test)(?:\.(?:only|skip|concurrent|sequential))?\s*\(\s*['"`][^'"`]*['"`]\s*,\s*(?:async\s*)?\(?[^)]*\)?\s*=>\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s;

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Checks if YAML metadata explicitly marks the test as pending.
 */
function checkYamlStatus(metadata: TestMetadata): boolean {
	return metadata.status === "pending";
}

/**
 * Checks if the test uses it.todo() syntax.
 */
function checkItTodo(testContent: string): boolean {
	return IT_TODO_REGEX.test(testContent);
}

/**
 * Checks if the test uses it.skip() syntax.
 */
function checkItSkip(testContent: string): boolean {
	return IT_SKIP_REGEX.test(testContent);
}

/**
 * Checks if the test uses Playwright's conditional skip syntax.
 * test.skip(true, "reason") skips all tests in the current describe block.
 */
function checkPlaywrightConditionalSkip(testContent: string): boolean {
	return PLAYWRIGHT_CONDITIONAL_SKIP_REGEX.test(testContent);
}

/**
 * Checks if the test is inside a describe.skip() block.
 */
function checkDescribeSkip(fullContent: string, testLine: number): boolean {
	// Simple heuristic: check if there's a describe.skip before this line
	const lines = fullContent.split("\n").slice(0, testLine);
	const contentBeforeTest = lines.join("\n");

	// Find all describe.skip and describe (closing) to determine nesting
	// This is simplified - proper AST parsing would be more accurate
	return DESCRIBE_SKIP_REGEX.test(contentBeforeTest);
}

/**
 * Checks if the test body contains NOT IMPLEMENTED patterns.
 */
function checkNotImplementedPattern(
	testBody: string,
): { found: true; pattern: string } | { found: false } {
	for (const pattern of NOT_IMPLEMENTED_PATTERNS) {
		if (pattern.test(testBody)) {
			const match = testBody.match(pattern);
			if (match?.[0]) {
				return { found: true, pattern: match[0] };
			}
		}
	}
	return { found: false };
}

/**
 * Checks if the test body contains any assertions.
 */
function checkHasAssertions(testBody: string): boolean {
	for (const pattern of ASSERTION_PATTERNS) {
		if (pattern.test(testBody)) {
			return true;
		}
	}
	return false;
}

/**
 * Extracts the test body from the content starting at a given line.
 * Returns the body content or null if extraction fails.
 */
function extractTestBody(content: string, afterLine: number): string | null {
	const lines = content.split("\n");
	const searchContent = lines.slice(afterLine - 1).join("\n");

	const match = searchContent.match(TEST_BODY_REGEX);
	return match?.[1] ?? null;
}

/**
 * Extracts test content around the YAML block for analysis.
 * Returns a window of content including the test definition.
 */
function getTestContentWindow(content: string, yamlEndLine: number, windowSize = 100): string {
	const lines = content.split("\n");
	const startLine = Math.max(0, yamlEndLine - 1);
	const endLine = Math.min(lines.length, yamlEndLine + windowSize);
	return lines.slice(startLine, endLine).join("\n");
}

// =============================================================================
// Main Detection Function
// =============================================================================

export interface DetectionContext {
	/** Full file content */
	content: string;
	/** Line number where YAML metadata ends */
	yamlEndLine: number;
	/** Parsed test metadata */
	metadata: TestMetadata;
}

/**
 * Detects the implementation status of a test.
 *
 * Detection priority (highest to lowest):
 * 1. Explicit YAML status: pending
 * 2. it.todo() syntax
 * 3. it.skip() syntax
 * 4. Body pattern matching for NOT IMPLEMENTED
 * 5. No assertions = stub
 * 6. Has assertions = complete
 *
 * @param context - Detection context with file content, position, and metadata
 * @returns Implementation status or undefined if detection fails
 */
export function detectImplementationStatus(context: DetectionContext): ImplementationStatus {
	const { content, yamlEndLine, metadata } = context;

	// Priority 1: Explicit YAML status
	if (checkYamlStatus(metadata)) {
		return {
			state: "stub",
			detected_from: "yaml-status",
			reason: "Explicit status: pending in YAML metadata",
		};
	}

	const testWindow = getTestContentWindow(content, yamlEndLine, DETECTION_WINDOW_LINES);

	// Count non-skipped it() blocks to determine if the file has real tests
	// alongside any todos/skips. Files with real tests + todos should be "complete".
	const itBlocks = testWindow.match(/\b(?:it|test)(?:\.(?:skip|todo))?\s*\(/g) ?? [];
	const skipBlocks = testWindow.match(/\b(?:it|test)\.skip\s*\(/g) ?? [];
	const todoBlocks = testWindow.match(/\b(?:it|test)\.todo\s*\(/g) ?? [];
	const nonSkippedCount = itBlocks.length - skipBlocks.length - todoBlocks.length;
	const hasTodo = checkItTodo(testWindow);
	const hasSkip = checkItSkip(testWindow);

	// Priority 2: it.todo() — only stub if ALL tests are todos (no real tests)
	if (hasTodo && nonSkippedCount === 0) {
		return {
			state: "stub",
			detected_from: "it-todo",
			reason: "Test defined with it.todo() - placeholder for future implementation",
		};
	}

	// Priority 3: it.skip() — only skipped if ALL tests are skipped (no real tests)
	if (hasSkip && nonSkippedCount === 0) {
		return {
			state: "skipped",
			detected_from: "it-skip",
			reason: "Test explicitly skipped with it.skip()",
		};
	}

	// Also check for describe.skip context — the entire describe is skipped,
	// so even if there are it() blocks with assertions inside, they're all skipped
	if (checkDescribeSkip(content, yamlEndLine)) {
		return {
			state: "skipped",
			detected_from: "it-skip",
			reason: "Test inside a skipped describe block",
		};
	}

	// Priority 3b: Playwright conditional skip test.skip(true, "reason")
	// This must come after the Vitest it.skip() check since that pattern
	// is more specific (requires quoted string argument).
	if (checkPlaywrightConditionalSkip(testWindow)) {
		return {
			state: "skipped",
			detected_from: "playwright-conditional-skip",
			reason: "Test skipped via Playwright conditional test.skip(condition, reason)",
		};
	}

	// Extract the test body for further analysis
	const testBody = extractTestBody(content, yamlEndLine);

	if (testBody !== null) {
		// Priority 4: NOT IMPLEMENTED patterns
		const notImplemented = checkNotImplementedPattern(testBody);
		if (notImplemented.found) {
			return {
				state: "not-implemented",
				detected_from: "body-pattern",
				reason: `Test throws NOT IMPLEMENTED: ${notImplemented.pattern ?? ""}`,
			};
		}

		// Priority 5 & 6: Assertion presence
		const hasAssertions = checkHasAssertions(testBody);

		if (hasAssertions) {
			return {
				state: "complete",
				detected_from: "has-assertions",
			};
		}

		// No assertions in extracted body - but the regex may have matched wrong body
		// (e.g., test name contains embedded quotes). Fall through to window check.
	}

	// Fallback: check the window for assertions
	// This handles cases where body extraction fails or matches wrong test
	const hasAssertionsInWindow = checkHasAssertions(testWindow);

	if (hasAssertionsInWindow) {
		return {
			state: "complete",
			detected_from: "has-assertions",
		};
	}

	// Default to stub if we can't determine
	return {
		state: "stub",
		detected_from: "no-assertions",
		reason: "Could not extract test body - assuming stub",
	};
}

/**
 * Batch detection for multiple tests in a file.
 * More efficient than calling detectImplementationStatus repeatedly
 * since it shares the file content.
 */
export function detectImplementationStatusBatch(
	content: string,
	tests: Array<{ yamlEndLine: number; metadata: TestMetadata }>,
): ImplementationStatus[] {
	return tests.map((test) =>
		detectImplementationStatus({
			content,
			yamlEndLine: test.yamlEndLine,
			metadata: test.metadata,
		}),
	);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if a test is considered incomplete (needs implementation).
 */
export function isIncomplete(status: ImplementationStatus): boolean {
	return status.state === "stub" || status.state === "not-implemented";
}

/**
 * Checks if a test is runnable (not skipped and has implementation).
 */
export function isRunnable(status: ImplementationStatus): boolean {
	return status.state === "complete";
}

/**
 * Gets a human-readable description of the implementation state.
 */
export function getStateDescription(state: ImplementationState): string {
	switch (state) {
		case "stub":
			return "Stub - awaiting implementation";
		case "complete":
			return "Complete - has assertions";
		case "skipped":
			return "Skipped - explicitly disabled";
		case "not-implemented":
			return "Not Implemented - throws placeholder error";
	}
}

/**
 * Counts implementation states in a collection.
 */
export function countByState(
	statuses: ImplementationStatus[],
): Record<ImplementationState, number> {
	const counts: Record<ImplementationState, number> = {
		stub: 0,
		complete: 0,
		skipped: 0,
		"not-implemented": 0,
	};

	for (const status of statuses) {
		counts[status.state]++;
	}

	return counts;
}

// =============================================================================
// Lifecycle Stage Detection
// =============================================================================

/**
 * Regex to match ALL it()/test() blocks including .skip() and .todo() variants.
 * Must match all variants so the subtraction logic in countAcceptanceCoverage
 * correctly computes non-skipped count: total - skip - todo = non-skipped.
 */
const IT_BLOCK_REGEX = /\b(?:it|test)(?:\.(?:skip|todo))?\s*\(/g;
const IT_SKIP_BLOCK_REGEX = /\b(?:it|test)\.skip\s*\(/g;
const IT_TODO_BLOCK_REGEX = /\b(?:it|test)\.todo\s*\(/g;

/**
 * Counts acceptance criteria coverage by comparing the number of
 * non-skipped it() blocks against the acceptance criteria array.
 *
 * This is intentionally simple: count it() blocks vs acceptance criteria count.
 * Not semantic matching — just "are there enough test cases?"
 */
function countAcceptanceCoverage(context: DetectionContext): { total: number; covered: number } {
	const criteria = context.metadata.acceptance ?? [];
	if (criteria.length === 0) return { total: 0, covered: 0 };

	const testWindow = getTestContentWindow(
		context.content,
		context.yamlEndLine,
		ACCEPTANCE_WINDOW_LINES,
	);

	// Playwright conditional skip: test.skip(true, "reason") at describe level
	// skips ALL tests in the block — none are actually covered
	if (checkPlaywrightConditionalSkip(testWindow)) {
		return { total: criteria.length, covered: 0 };
	}

	const itBlocks = testWindow.match(IT_BLOCK_REGEX) ?? [];
	const skipBlocks = testWindow.match(IT_SKIP_BLOCK_REGEX) ?? [];
	const todoBlocks = testWindow.match(IT_TODO_BLOCK_REGEX) ?? [];
	const nonSkipped = itBlocks.length - skipBlocks.length - todoBlocks.length;

	return {
		total: criteria.length,
		covered: Math.min(Math.max(nonSkipped, 0), criteria.length),
	};
}

/**
 * Detects the lifecycle stage of a requirement.
 *
 * Lifecycle stages:
 * - stub: Test is placeholder (.skip, .todo, no assertions, status: pending)
 * - coded: Test has real assertions but not all acceptance criteria covered
 * - tested: All acceptance criteria have corresponding assertions
 * - deployed: Has SMOKE test linkage or deployment marker (deferred to Wave 4)
 *
 * @param context - Detection context with file content, position, and metadata
 * @returns Lifecycle status with stage and acceptance coverage
 */
export function detectLifecycleStage(context: DetectionContext): LifecycleStatus {
	const implStatus = detectImplementationStatus(context);
	const { total, covered } = countAcceptanceCoverage(context);

	// Stage 1: Stub — test is not implemented
	if (implStatus.state === "stub" || implStatus.state === "not-implemented") {
		return {
			stage: "stub",
			acceptance_total: total,
			acceptance_covered: 0,
			detected_from: `impl-${implStatus.state}`,
		};
	}

	// Skipped tests are also stubs from a lifecycle perspective
	if (implStatus.state === "skipped") {
		return {
			stage: "stub",
			acceptance_total: total,
			acceptance_covered: 0,
			detected_from: "impl-skipped",
		};
	}

	// Stage 2 vs 3: Check acceptance criteria coverage
	if (total === 0) {
		// No acceptance criteria defined — treat as coded (can't verify "tested")
		return {
			stage: "coded",
			acceptance_total: 0,
			acceptance_covered: 0,
			detected_from: "no-acceptance-criteria",
		};
	}

	if (covered < total) {
		return {
			stage: "coded",
			acceptance_total: total,
			acceptance_covered: covered,
			detected_from: "partial-acceptance",
		};
	}

	// All acceptance criteria covered = tested
	// Deployed promotion happens in surface-gen.ts via SMOKE test cross-referencing
	return {
		stage: "tested",
		acceptance_total: total,
		acceptance_covered: covered,
		detected_from: "full-acceptance",
	};
}

/**
 * Counts lifecycle stages in a collection.
 */
export function countByLifecycleStage(statuses: LifecycleStatus[]): Record<LifecycleStage, number> {
	const counts: Record<LifecycleStage, number> = {
		stub: 0,
		coded: 0,
		tested: 0,
		deployed: 0,
	};

	for (const status of statuses) {
		counts[status.stage]++;
	}

	return counts;
}

/**
 * Gets a human-readable description of a lifecycle stage.
 */
export function getLifecycleDescription(stage: LifecycleStage): string {
	switch (stage) {
		case "stub":
			return "Stub — requirement captured, awaiting implementation";
		case "coded":
			return "Coded — implementation exists, acceptance criteria incomplete";
		case "tested":
			return "Tested — all acceptance criteria covered";
		case "deployed":
			return "Deployed — live in production, smoke-tested";
	}
}

// =============================================================================
// Deployed Stage Promotion
// =============================================================================

/**
 * Builds a map of requirement IDs to the SMOKE test that verifies them.
 * Uses ParsedTest[] since `verifies` is on TestMetadata, not Requirement.
 */
export function buildSmokeVerificationMap(tests: ParsedTest[]): Map<string, string> {
	const map = new Map<string, string>(); // reqId -> smokeTestId
	for (const test of tests) {
		if (test.metadata.type === "smoke" && test.metadata.smoke) {
			const verifiedIds = test.metadata.verifies ?? [];
			for (const id of verifiedIds) {
				map.set(id, test.metadata.smoke);
			}
		}
	}
	return map;
}

/**
 * Promotes requirements from "tested" to "deployed" if a SMOKE test verifies them.
 *
 * A requirement becomes "deployed" when:
 * 1. Its lifecycle stage is "tested" (all acceptance criteria covered)
 * 2. A SMOKE-* test exists whose `verifies` array includes this requirement's ID
 */
export function promoteToDeployed(
	allRequirements: Requirement[],
	smokeMap: Map<string, string>,
): void {
	if (smokeMap.size === 0) return;

	for (const req of allRequirements) {
		const smokeTestId = smokeMap.get(req.id);
		if (req.lifecycle?.stage === "tested" && smokeTestId) {
			req.lifecycle = {
				...req.lifecycle,
				stage: "deployed",
				detected_from: "smoke-test",
				smoke_test: smokeTestId,
			};
		}
	}
}
