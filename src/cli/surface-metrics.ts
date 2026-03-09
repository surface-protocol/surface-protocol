/**
 * surface metrics — Adoption Tracking
 */

import { execSync } from "node:child_process";
import chalk from "chalk";
import type { Command } from "commander";
import { buildClassifiedCommit } from "../lib/commit-classifier.js";
import type { AdoptionReport, ClassifiedCommit } from "../lib/types.js";

const COMMIT_MARKER = "COMMIT:";

function parseGitLog(raw: string): ClassifiedCommit[] {
	const commits: ClassifiedCommit[] = [];
	const lines = raw.split("\n");
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";
		if (!line.startsWith(COMMIT_MARKER)) {
			i++;
			continue;
		}

		const header = line.slice(COMMIT_MARKER.length);
		const p1 = header.indexOf("|");
		const p2 = header.indexOf("|", p1 + 1);
		const p3 = header.indexOf("|", p2 + 1);
		if (p1 === -1 || p2 === -1 || p3 === -1) {
			i++;
			continue;
		}

		const hash = header.slice(0, p1);
		const author = header.slice(p1 + 1, p2);
		const date = header.slice(p2 + 1, p3);
		const subject = header.slice(p3 + 1);
		if (subject.startsWith("Merge ")) {
			i++;
			continue;
		}

		i++;
		const bodyLines: string[] = [];
		while (i < lines.length && !(lines[i] ?? "").startsWith(COMMIT_MARKER)) {
			const l = (lines[i] ?? "").trim();
			if (l !== "") bodyLines.push(l);
			i++;
		}

		commits.push(buildClassifiedCommit(hash, author, date, subject, bodyLines.join("\n")));
	}
	return commits;
}

function generateReport(commits: ClassifiedCommit[], since: string, until: string): AdoptionReport {
	const routed = commits.filter((c) => c.classification === "surface-routed");
	const bypass = commits.filter((c) => c.classification === "bypass");

	const bySignal: Record<string, number> = {};
	for (const c of routed) {
		if (c.signal) bySignal[c.signal] = (bySignal[c.signal] ?? 0) + 1;
	}

	const byAuthor: Record<string, { routed: number; bypass: number }> = {};
	for (const c of commits) {
		const entry = byAuthor[c.author] ?? { routed: 0, bypass: 0 };
		if (!byAuthor[c.author]) byAuthor[c.author] = entry;
		entry[c.classification === "surface-routed" ? "routed" : "bypass"]++;
	}

	const byBypassCategory: Record<string, number> = {};
	for (const c of bypass) {
		const cat = c.bypass_category ?? "unknown";
		byBypassCategory[cat] = (byBypassCategory[cat] ?? 0) + 1;
	}

	const weekMap = new Map<string, { routed: number; bypass: number }>();
	for (const c of commits) {
		const d = new Date(c.date);
		const day = d.getUTCDay();
		const monday = new Date(d);
		monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
		const weekStart = monday.toISOString().slice(0, 10);
		let week = weekMap.get(weekStart);
		if (!week) {
			week = { routed: 0, bypass: 0 };
			weekMap.set(weekStart, week);
		}
		if (c.classification === "surface-routed") week.routed++;
		else week.bypass++;
	}

	const weeklyTrend = [...weekMap.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([week, { routed: r, bypass: b }]) => ({
			week,
			routed: r,
			bypass: b,
			adoption_percent: r + b > 0 ? Math.round((r / (r + b)) * 100) : 0,
		}));

	const total = commits.length;
	return {
		period: { since, until },
		totals: { commits: total, routed: routed.length, bypass: bypass.length },
		rates: { adoption_percent: total > 0 ? Math.round((routed.length / total) * 100) : 0 },
		breakdowns: { by_signal: bySignal, by_author: byAuthor, by_bypass_category: byBypassCategory },
		weekly_trend: weeklyTrend,
	};
}

function displayReport(
	report: AdoptionReport,
	commits: ClassifiedCommit[],
	verbose: boolean,
): void {
	const { totals, rates } = report;
	console.log("");
	console.log(chalk.bold("Surface Protocol Adoption Metrics"));
	console.log(chalk.dim(`Period: ${report.period.since} .. ${report.period.until}`));
	console.log("");
	const color =
		rates.adoption_percent >= 80
			? chalk.green
			: rates.adoption_percent >= 50
				? chalk.yellow
				: chalk.red;
	console.log(`  Total commits:    ${chalk.bold(String(totals.commits))}`);
	console.log(`  Surface-routed:   ${chalk.green(String(totals.routed))}`);
	console.log(`  Bypass:           ${chalk.red(String(totals.bypass))}`);
	console.log(`  Adoption rate:    ${color(`${rates.adoption_percent}%`)}`);
	console.log("");

	if (Object.keys(report.breakdowns.by_signal).length > 0) {
		console.log(chalk.bold("  Routed by signal:"));
		for (const [signal, count] of Object.entries(report.breakdowns.by_signal).sort(
			([, a], [, b]) => b - a,
		)) {
			console.log(`    ${signal.padEnd(22)} ${count}`);
		}
		console.log("");
	}

	if (verbose) {
		console.log(chalk.bold("  Commits:"));
		for (const c of commits) {
			const icon =
				c.classification === "surface-routed" ? chalk.green("\u2713") : chalk.red("\u2717");
			const detail = c.signal ?? c.bypass_category ?? "";
			console.log(
				`    ${icon} ${chalk.dim(c.hash.slice(0, 7))} ${c.summary} ${chalk.dim(`[${detail}]`)}`,
			);
		}
		console.log("");
	}
}

export function registerMetricsCommand(program: Command): void {
	program
		.command("metrics")
		.description("Surface Protocol adoption metrics")
		.option("--since <range>", "Date or git range", "30 days ago")
		.option("--json", "Machine-readable JSON output")
		.option("--verbose", "Show each commit classification")
		.action(async (opts) => {
			const since: string = opts.since;
			const isRange = since.includes("..");
			try {
				const format = `${COMMIT_MARKER}%H|%an|%cs|%s%n%b`;
				const gitCmd = isRange
					? `git log --format="${format}" ${since}`
					: `git log --format="${format}" --since="${since}"`;
				const raw = execSync(gitCmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
				const commits = parseGitLog(raw);
				const until = new Date().toISOString().slice(0, 10);
				const report = generateReport(commits, since, until);

				if (opts.json) console.log(JSON.stringify(report, null, 2));
				else displayReport(report, commits, !!opts.verbose);
			} catch (error) {
				if (error instanceof Error && error.message.includes("not a git repository")) {
					console.error(chalk.red("Error: Not a git repository"));
					process.exit(1);
				}
				throw error;
			}
		});
}
