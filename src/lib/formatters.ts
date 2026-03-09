/**
 * Surface Protocol Output Formatters
 *
 * Functions for formatting output in various formats: CLI tables, markdown, JSON.
 */

import chalk from "chalk";
import type {
	CoverageReport,
	LifecycleStage,
	Requirement,
	SurfaceMap,
	ValidationError,
} from "./types.js";

// =============================================================================
// Acceptance Criteria Normalization
// =============================================================================

/**
 * Converts an acceptance criterion to a string.
 * YAML entries like `- BTO flow: authorize -> ...` parse as objects {key: value}.
 * This converts them to "key: value" strings.
 */
function stringifyCriterion(criterion: unknown): string {
	if (typeof criterion === "string") return criterion;
	if (typeof criterion === "object" && criterion !== null) {
		const entries = Object.entries(criterion);
		if (entries.length === 1) {
			const [key, value] = entries[0] as [string, unknown];
			return `${key}: ${value}`;
		}
		return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
	}
	return String(criterion);
}

/**
 * Normalizes an acceptance array so every entry is a plain string.
 * Use at parse time to ensure surface.json contains only string[].
 */
export function normalizeAcceptance(acceptance: unknown[] | undefined): string[] | undefined {
	if (!acceptance) return undefined;
	return acceptance.map(stringifyCriterion);
}

// =============================================================================
// Table Formatting
// =============================================================================

interface TableColumn {
	header: string;
	key: string;
	width?: number;
	align?: "left" | "right" | "center";
}

/**
 * Formats data as a CLI table.
 */
export function formatTable<T extends Record<string, unknown>>(
	data: T[],
	columns: TableColumn[],
): string {
	if (data.length === 0) {
		return "(no data)";
	}

	// Calculate column widths
	const widths = columns.map((col) => {
		const headerWidth = col.header.length;
		const maxDataWidth = Math.max(...data.map((row) => String(row[col.key] ?? "").length));
		return col.width ?? Math.max(headerWidth, maxDataWidth);
	});

	// Build header
	const header = columns
		.map((col, i) => padString(col.header, widths[i] ?? 0, col.align))
		.join("  ");
	const separator = widths.map((w) => "-".repeat(w)).join("  ");

	// Build rows
	const rows = data.map((row) =>
		columns
			.map((col, i) => padString(String(row[col.key] ?? ""), widths[i] ?? 0, col.align))
			.join("  "),
	);

	return [header, separator, ...rows].join("\n");
}

function padString(
	str: string,
	width: number,
	align: "left" | "right" | "center" = "left",
): string {
	const len = str.length;
	if (len >= width) return str.slice(0, width);

	const padding = width - len;
	switch (align) {
		case "right":
			return " ".repeat(padding) + str;
		case "center": {
			const left = Math.floor(padding / 2);
			return " ".repeat(left) + str + " ".repeat(padding - left);
		}
		default:
			return str + " ".repeat(padding);
	}
}

// =============================================================================
// Markdown Formatting
// =============================================================================

/**
 * Generates SURFACE.md from a surface map.
 */
export function formatMarkdown(surfaceMap: SurfaceMap): string {
	const lines: string[] = [];

	// Header
	lines.push("# Surface Map");
	lines.push("");
	lines.push(`> Generated: ${surfaceMap.generated}`);
	lines.push(`> Protocol Version: ${surfaceMap.version}`);
	lines.push("");

	// Stats
	lines.push("## Statistics");
	lines.push("");
	lines.push(`- **Total Requirements:** ${surfaceMap.stats.total}`);
	lines.push(
		`- **Coverage:** ${surfaceMap.stats.coverage.with_metadata} with metadata, ${surfaceMap.stats.coverage.without_metadata} without`,
	);
	lines.push("");

	// By Type
	lines.push("### By Type");
	lines.push("");
	lines.push("| Type | Count |");
	lines.push("|------|-------|");
	for (const [type, count] of Object.entries(surfaceMap.stats.by_type)) {
		lines.push(`| ${type} | ${count} |`);
	}
	lines.push("");

	// By Area
	if (Object.keys(surfaceMap.stats.by_area).length > 0) {
		lines.push("### By Area");
		lines.push("");
		lines.push("| Area | Count |");
		lines.push("|------|-------|");
		for (const [area, count] of Object.entries(surfaceMap.stats.by_area)) {
			lines.push(`| ${area} | ${count} |`);
		}
		lines.push("");
	}

	// Lifecycle breakdown
	const allReqs = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
	];
	const lifecycleCounts: Record<LifecycleStage, number> = {
		stub: 0,
		coded: 0,
		tested: 0,
		deployed: 0,
	};
	for (const req of allReqs) {
		if (req.lifecycle) {
			lifecycleCounts[req.lifecycle.stage]++;
		}
	}
	if (allReqs.length > 0) {
		lines.push("### Lifecycle");
		lines.push("");
		lines.push("| Stage | Count |");
		lines.push("|-------|-------|");
		for (const [stage, count] of Object.entries(lifecycleCounts)) {
			lines.push(`| ${stage} | ${count} |`);
		}
		lines.push("");
	}

	// Requirements
	if (surfaceMap.requirements.length > 0) {
		lines.push("## Requirements");
		lines.push("");
		for (const req of surfaceMap.requirements) {
			lines.push(formatRequirementMarkdown(req));
			lines.push("");
		}
	}

	// Regressions
	if (surfaceMap.regressions.length > 0) {
		lines.push("## Regressions");
		lines.push("");
		for (const req of surfaceMap.regressions) {
			lines.push(formatRequirementMarkdown(req));
			lines.push("");
		}
	}

	// Flows
	if (surfaceMap.flows.length > 0) {
		lines.push("## Flows");
		lines.push("");
		for (const req of surfaceMap.flows) {
			lines.push(formatRequirementMarkdown(req));
			lines.push("");
		}
	}

	// Contracts
	if (surfaceMap.contracts.length > 0) {
		lines.push("## Contracts");
		lines.push("");
		for (const req of surfaceMap.contracts) {
			lines.push(formatRequirementMarkdown(req));
			lines.push("");
		}
	}

	// Placeholders
	if (surfaceMap.placeholders.length > 0) {
		lines.push("## Placeholders");
		lines.push("");
		lines.push("| Component | Status | Created | Description |");
		lines.push("|-----------|--------|---------|-------------|");
		for (const ph of surfaceMap.placeholders) {
			lines.push(`| ${ph.component} | ${ph.status} | ${ph.created} | ${ph.description ?? "-"} |`);
		}
		lines.push("");
	}

	// Gaps
	if (surfaceMap.gaps.length > 0) {
		lines.push("## Coverage Gaps");
		lines.push("");
		lines.push("| File | Reason |");
		lines.push("|------|--------|");
		for (const gap of surfaceMap.gaps) {
			lines.push(`| ${gap.file} | ${gap.reason} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

const LIFECYCLE_BADGES: Record<LifecycleStage, string> = {
	stub: "stub",
	coded: "coded",
	tested: "tested",
	deployed: "deployed",
};

function formatRequirementMarkdown(req: Requirement): string {
	const lines: string[] = [];

	// Title with lifecycle badge and tags
	const lifecycleBadge = req.lifecycle ? ` [${LIFECYCLE_BADGES[req.lifecycle.stage]}]` : "";
	const tags = req.tags.length > 0 ? ` \`${req.tags.join("` `")}\`` : "";
	lines.push(`### ${req.id}: ${req.summary}${lifecycleBadge}${tags}`);
	lines.push("");

	// Metadata
	lines.push(`- **Type:** ${req.type}`);
	if (req.area) lines.push(`- **Area:** ${req.area}`);
	lines.push(`- **Status:** ${req.status}`);
	if (req.lifecycle) {
		lines.push(`- **Lifecycle:** ${req.lifecycle.stage}`);
		if (req.lifecycle.acceptance_total > 0) {
			lines.push(
				`- **Acceptance:** ${req.lifecycle.acceptance_covered}/${req.lifecycle.acceptance_total}`,
			);
		}
	}
	lines.push(`- **Location:** \`${req.location.file}:${req.location.line}\``);
	if (req.flaky) lines.push(`- **Flaky:** Yes`);

	// Rationale
	if (req.rationale) {
		lines.push("");
		lines.push("**Rationale:**");
		lines.push(req.rationale);
	}

	// Acceptance criteria
	if (req.acceptance && req.acceptance.length > 0) {
		lines.push("");
		lines.push("**Acceptance Criteria:**");
		for (const criterion of req.acceptance) {
			lines.push(`- ${stringifyCriterion(criterion)}`);
		}
	}

	return lines.join("\n");
}

// =============================================================================
// JSON Formatting
// =============================================================================

/**
 * Formats data as pretty JSON.
 */
export function formatJson(data: unknown): string {
	return JSON.stringify(data, null, "\t");
}

// =============================================================================
// CLI Output Formatting
// =============================================================================

/**
 * Formats validation errors for CLI output.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
	if (errors.length === 0) {
		return chalk.green("No errors found");
	}

	const lines = errors.map((e) => {
		const location = e.line ? `${e.file}:${e.line}` : e.file;
		const field = e.field ? ` (${e.field})` : "";
		const icon = e.severity === "error" ? chalk.red("x") : chalk.yellow("!");
		const msg = e.severity === "error" ? chalk.red(e.message) : chalk.yellow(e.message);
		return `  ${icon} ${chalk.dim(location)}${field}: ${msg}`;
	});

	return lines.join("\n");
}

/**
 * Formats a coverage report for CLI output.
 */
export function formatCoverageReport(report: CoverageReport): string {
	const lines: string[] = [];

	lines.push(chalk.bold("Coverage Report"));
	lines.push("");
	lines.push(`Total tests:     ${report.total_tests}`);
	lines.push(`With metadata:   ${report.with_metadata}`);
	lines.push(`Without:         ${report.without_metadata}`);
	lines.push(`Coverage:        ${chalk.bold(report.coverage_percent.toFixed(1))}%`);
	lines.push("");

	lines.push(chalk.bold("By Type:"));
	for (const [type, count] of Object.entries(report.by_type)) {
		lines.push(`  ${type}: ${count}`);
	}
	lines.push("");

	if (Object.keys(report.by_area).length > 0) {
		lines.push(chalk.bold("By Area:"));
		for (const [area, count] of Object.entries(report.by_area)) {
			lines.push(`  ${area}: ${count}`);
		}
		lines.push("");
	}

	if (report.dangerous_count > 0) {
		lines.push(chalk.red(`DANGEROUS requirements: ${report.dangerous_count}`));
	}

	if (report.flaky_count > 0) {
		lines.push(chalk.yellow(`Flaky tests: ${report.flaky_count}`));
	}

	if (report.override_count > 0) {
		lines.push(chalk.yellow(`Active overrides: ${report.override_count}`));
	}

	if (report.gaps.length > 0) {
		lines.push("");
		lines.push(chalk.bold(`Gaps (${report.gaps.length}):`));
		for (const gap of report.gaps.slice(0, 10)) {
			lines.push(chalk.dim(`  ${gap.file}: ${gap.reason}`));
		}
		if (report.gaps.length > 10) {
			lines.push(chalk.dim(`  ... and ${report.gaps.length - 10} more`));
		}
	}

	return lines.join("\n");
}

/**
 * Formats a status message with icon.
 */
export function formatStatus(status: "CURRENT" | "STALE" | "INVALID", message?: string): string {
	switch (status) {
		case "CURRENT":
			return chalk.green("CURRENT") + (message ? ` - ${message}` : "");
		case "STALE":
			return chalk.yellow("STALE") + (message ? ` - ${message}` : "");
		case "INVALID":
			return chalk.red("INVALID") + (message ? ` - ${message}` : "");
	}
}

/**
 * Formats a list of requirements for CLI output.
 */
export function formatRequirementsList(
	requirements: Requirement[],
	options: { showLocation?: boolean; showTags?: boolean } = {},
): string {
	const { showLocation = false, showTags = true } = options;

	return requirements
		.map((req) => {
			const parts = [`${chalk.bold(req.id)}: ${req.summary}`];

			if (showTags && req.tags.length > 0) {
				const tagStr = req.tags
					.map((t) =>
						["critical", "compliance", "security", "blocking"].includes(t)
							? chalk.red(t)
							: chalk.dim(t),
					)
					.join(" ");
				parts.push(tagStr);
			}

			if (showLocation) {
				parts.push(chalk.dim(`${req.location.file}:${req.location.line}`));
			}

			return parts.join("\n  ");
		})
		.join("\n\n");
}

// =============================================================================
// ASCII Box Formatting
// =============================================================================

/**
 * Wraps text in an ASCII box.
 */
export function formatBox(
	content: string,
	options: { title?: string; width?: number } = {},
): string {
	const { title, width = 70 } = options;
	const innerWidth = width - 4; // Account for box borders and padding

	const lines = content
		.split("\n")
		.flatMap((line) => (line.length <= innerWidth ? [line] : wrapText(line, innerWidth)));

	const top = title
		? `+${"=".repeat(width - 2)}+\n|  ${title.padEnd(width - 4)}  |`
		: `+${"-".repeat(width - 2)}+`;

	const bottom = `+${"-".repeat(width - 2)}+`;

	const body = lines.map((line) => `|  ${line.padEnd(innerWidth)}  |`).join("\n");

	return [top, body, bottom].join("\n");
}

function wrapText(text: string, width: number): string[] {
	const words = text.split(" ");
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		if (current.length + word.length + 1 <= width) {
			current += (current ? " " : "") + word;
		} else {
			if (current) lines.push(current);
			current = word;
		}
	}

	if (current) lines.push(current);
	return lines;
}

// =============================================================================
// Feature Doc Formatting
// =============================================================================

const LIFECYCLE_EMOJI: Record<LifecycleStage, string> = {
	stub: "[ ]",
	coded: "[~]",
	tested: "[x]",
	deployed: "[x]",
};

/**
 * Groups all requirements in a surface map by area.
 * Requirements without an area are grouped under "uncategorized".
 */
export function groupRequirementsByArea(surfaceMap: SurfaceMap): Map<string, Requirement[]> {
	const allReqs = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
	];

	const grouped = new Map<string, Requirement[]>();

	for (const req of allReqs) {
		const area = req.area ?? "uncategorized";
		const existing = grouped.get(area) ?? [];
		existing.push(req);
		grouped.set(area, existing);
	}

	return grouped;
}

/**
 * Formats a single feature area doc from its requirements.
 * Produces a markdown file suitable for docs/features/<area>.md.
 */
export function formatFeatureDoc(
	area: string,
	requirements: Requirement[],
	generated: string,
): string {
	const lines: string[] = [];

	// Header
	const title = area.charAt(0).toUpperCase() + area.slice(1);
	lines.push(`# ${title}`);
	lines.push("");
	lines.push(`> Auto-generated from surface.json. Do not edit manually.`);
	lines.push(`> Generated: ${generated}`);
	lines.push("");

	// Lifecycle summary
	const counts: Record<LifecycleStage, number> = { stub: 0, coded: 0, tested: 0, deployed: 0 };
	for (const req of requirements) {
		if (req.lifecycle) {
			counts[req.lifecycle.stage]++;
		}
	}
	const total = requirements.length;
	const complete = counts.tested + counts.deployed;
	lines.push(`**Progress:** ${complete}/${total} requirements complete`);
	lines.push(`| stub | coded | tested | deployed |`);
	lines.push(`|------|-------|--------|----------|`);
	lines.push(`| ${counts.stub} | ${counts.coded} | ${counts.tested} | ${counts.deployed} |`);
	lines.push("");

	// Requirements list
	lines.push("## Requirements");
	lines.push("");

	// Sort: stubs first, then coded, tested, deployed
	const stageOrder: Record<LifecycleStage, number> = { stub: 0, coded: 1, tested: 2, deployed: 3 };
	const sorted = [...requirements].sort((a, b) => {
		const aStage = a.lifecycle?.stage ?? "stub";
		const bStage = b.lifecycle?.stage ?? "stub";
		return stageOrder[aStage] - stageOrder[bStage];
	});

	for (const req of sorted) {
		const stage = req.lifecycle?.stage ?? "stub";
		const check = LIFECYCLE_EMOJI[stage];
		const badge = stage !== "tested" && stage !== "deployed" ? ` \`${stage}\`` : "";
		lines.push(`- ${check} **${req.id}:** ${req.summary}${badge}`);

		// Acceptance criteria
		if (req.acceptance && req.acceptance.length > 0) {
			const covered = req.lifecycle?.acceptance_covered ?? 0;
			const total = req.lifecycle?.acceptance_total ?? req.acceptance.length;
			if (covered < total) {
				lines.push(`  - Acceptance: ${covered}/${total} criteria covered`);
			}
		}
	}

	lines.push("");
	lines.push("---");
	lines.push("");

	// Detailed requirement sections
	lines.push("## Details");
	lines.push("");

	for (const req of sorted) {
		const stage = req.lifecycle?.stage ?? "stub";
		lines.push(`### ${req.id}: ${req.summary}`);
		lines.push("");
		lines.push(`- **Type:** ${req.type}`);
		lines.push(`- **Lifecycle:** ${stage}`);
		if (req.tags.length > 0) {
			lines.push(`- **Tags:** ${req.tags.map((t) => `\`${t}\``).join(", ")}`);
		}
		if (req.source) {
			lines.push(`- **Source:** ${req.source.type} — ${req.source.ref}`);
		}
		lines.push(`- **Test:** \`${req.location.file}:${req.location.line}\``);

		if (req.rationale) {
			lines.push("");
			lines.push(req.rationale.trim());
		}

		if (req.acceptance && req.acceptance.length > 0) {
			lines.push("");
			lines.push("**Acceptance Criteria:**");
			for (const criterion of req.acceptance) {
				lines.push(`- ${stringifyCriterion(criterion)}`);
			}
		}

		lines.push("");
	}

	return lines.join("\n");
}
