/**
 * Comment Format Definitions
 *
 * Defines how YAML frontmatter is embedded in different languages.
 * Each format specifies the delimiters and any line-level preprocessing.
 */

import type { CommentFormat } from "./adapters/adapter.js";

// =============================================================================
// Built-in Comment Formats
// =============================================================================

/**
 * JavaScript/TypeScript block comment format.
 *
 * ```typescript
 * /*---
 * req: REQ-001
 * type: unit
 * summary: Example test
 * ---*​/
 * ```
 */
export const JS_BLOCK: CommentFormat = {
	name: "js-block",
	openPattern: "\\/\\*---\\n",
	closePattern: "\\n---\\*\\/",
	openLiteral: "/*---\n",
	closeLiteral: "\n---*/",
	languages: ["typescript", "javascript", "java", "csharp"],
};

/**
 * Hash-prefixed comment format (Ruby, Python, Shell).
 *
 * ```ruby
 * #---
 * # req: REQ-001
 * # type: unit
 * # summary: Example test
 * #---
 * ```
 *
 * Each YAML line is prefixed with "# ". The parser strips this prefix
 * before parsing the YAML content.
 */
export const HASH_BLOCK: CommentFormat = {
	name: "hash-block",
	openPattern: "#---\\n",
	closePattern: "\\n#---",
	openLiteral: "#---\n",
	closeLiteral: "\n#---",
	languages: ["ruby", "python", "shell"],
	linePrefix: "# ",
};

// =============================================================================
// Experimental Formats
// =============================================================================

/**
 * Ruby =begin/=end block format (experimental).
 *
 * ```ruby
 * =begin surface
 * req: REQ-001
 * type: unit
 * summary: Example test
 * =end
 * ```
 */
export const RUBY_BLOCK: CommentFormat = {
	name: "ruby-block",
	openPattern: "=begin surface\\n",
	closePattern: "\\n=end",
	openLiteral: "=begin surface\n",
	closeLiteral: "\n=end",
	languages: ["ruby"],
};

/**
 * Python triple-quote format (experimental).
 *
 * ```python
 * \"\"\"---
 * req: REQ-001
 * type: unit
 * summary: Example test
 * ---\"\"\"
 * ```
 */
export const PYTHON_TRIPLE: CommentFormat = {
	name: "python-triple",
	openPattern: '"""---\\n',
	closePattern: '\\n---"""',
	openLiteral: '"""---\n',
	closeLiteral: '\n---"""',
	languages: ["python"],
};

// =============================================================================
// Format Registry
// =============================================================================

const FORMAT_REGISTRY: Record<string, CommentFormat> = {
	"js-block": JS_BLOCK,
	"hash-block": HASH_BLOCK,
	// Experimental formats — exported but not in registry until parser support is added
	// "ruby-block": RUBY_BLOCK,
	// "python-triple": PYTHON_TRIPLE,
};

/**
 * Get a comment format by name.
 */
export function getCommentFormat(name: string): CommentFormat | undefined {
	return FORMAT_REGISTRY[name];
}

/**
 * Get all registered comment format names.
 */
export function getCommentFormatNames(): string[] {
	return Object.keys(FORMAT_REGISTRY);
}

/**
 * Build a regex for extracting YAML frontmatter using the given format.
 *
 * Returns a global regex that captures the YAML content between delimiters.
 */
export function buildFrontmatterRegex(format: CommentFormat): RegExp {
	// Allow optional leading whitespace (tabs/spaces) before both delimiters.
	// This handles YAML blocks indented inside describe() or context() blocks.
	// The close pattern typically starts with \n, so we inject [ \t]* after it.
	const closeWithIndent = format.closePattern.replace(/^\\n/, "\\n[ \\t]*");
	return new RegExp(`[ \\t]*${format.openPattern}([\\s\\S]*?)${closeWithIndent}`, "g");
}

/**
 * Preprocess YAML content extracted from a comment block.
 * Strips line prefixes if the format defines one, then dedents
 * any common leading whitespace (handles indented YAML blocks).
 */
export function preprocessYaml(content: string, format: CommentFormat): string {
	let processed = content;

	if (format.linePrefix) {
		processed = processed
			.split("\n")
			.map((line) => {
				if (line.startsWith(format.linePrefix!)) {
					return line.slice(format.linePrefix?.length);
				}
				// Handle lines that are just the prefix without trailing content
				if (line.trimEnd() === format.linePrefix?.trimEnd()) {
					return "";
				}
				return line;
			})
			.join("\n");
	}

	// Dedent: strip common leading whitespace (tabs/spaces) from all non-empty lines.
	// This handles YAML blocks indented inside describe() or context() blocks.
	return dedent(processed);
}

/**
 * Remove common leading whitespace from all non-empty lines.
 */
function dedent(text: string): string {
	const lines = text.split("\n");
	const nonEmpty = lines.filter((l) => l.trim().length > 0);
	if (nonEmpty.length === 0) return text;

	const indent = nonEmpty.reduce((min, line) => {
		const match = line.match(/^[ \t]*/);
		const len = match ? match[0].length : 0;
		return Math.min(min, len);
	}, Number.POSITIVE_INFINITY);

	if (indent === 0 || indent === Number.POSITIVE_INFINITY) return text;

	return lines.map((l) => (l.trim().length > 0 ? l.slice(indent) : l)).join("\n");
}
