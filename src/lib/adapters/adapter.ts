/**
 * Stack Adapter Interface
 *
 * Each adapter defines how Surface Protocol interacts with a specific
 * test framework: file discovery, metadata format, stub generation,
 * assertion detection, and lifecycle heuristics.
 */

import type { TestMetadata } from "../types.js";

// =============================================================================
// Comment Format
// =============================================================================

/**
 * Defines how YAML frontmatter is embedded in test files.
 * Different languages use different comment syntax.
 */
export interface CommentFormat {
	/** Unique identifier for this format */
	name: string;
	/** Regex source for the opening delimiter */
	openPattern: string;
	/** Regex source for the closing delimiter */
	closePattern: string;
	/** Literal string to write when generating stubs (opening) */
	openLiteral: string;
	/** Literal string to write when generating stubs (closing) */
	closeLiteral: string;
	/** Languages this format applies to */
	languages: string[];
	/**
	 * Optional line prefix to strip before parsing YAML.
	 * For hash-block format, each line is prefixed with "# ".
	 * Set to "# " to strip it before YAML parsing.
	 */
	linePrefix?: string;
}

// =============================================================================
// Stack Adapter
// =============================================================================

/**
 * A stack adapter tells Surface Protocol how to work with a specific
 * test framework and language combination.
 */
export interface StackAdapter {
	/** Unique identifier for this adapter */
	name: string;

	/** Human-readable description */
	description: string;

	/** Glob patterns for discovering test files */
	filePatterns: string[];

	/** How YAML metadata is embedded in test files */
	commentFormat: CommentFormat;

	/**
	 * Generate a test stub file from metadata.
	 * Returns the full file content including frontmatter and test skeleton.
	 */
	stubTemplate: (metadata: TestMetadata) => string;

	/** Regex patterns that indicate assertions exist in a test body */
	assertionPatterns: RegExp[];

	/** Regex patterns that indicate a test is a stub/pending */
	stubPatterns: RegExp[];

	/** Regex patterns that indicate a test is skipped */
	skipPatterns: RegExp[];

	/** Command to run the test suite */
	testCommand: string;

	/** Regex to find describe/context blocks in test files */
	describePattern: RegExp;

	/** Regex to find it/test/example blocks in test files */
	itPattern: RegExp;
}

// =============================================================================
// Adapter Registry
// =============================================================================

const adapterRegistry = new Map<string, StackAdapter>();

/**
 * Register a stack adapter.
 */
export function registerAdapter(adapter: StackAdapter): void {
	adapterRegistry.set(adapter.name, adapter);
}

/**
 * Get a registered adapter by name.
 */
export function getAdapter(name: string): StackAdapter | undefined {
	return adapterRegistry.get(name);
}

/**
 * Get all registered adapter names.
 */
export function getAdapterNames(): string[] {
	return [...adapterRegistry.keys()];
}
