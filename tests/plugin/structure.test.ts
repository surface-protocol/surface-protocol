import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const PLUGIN = join(ROOT, "plugin");

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf-8"));
}

describe("Claude Code plugin structure", () => {
	describe("marketplace", () => {
		const marketplacePath = join(ROOT, ".claude-plugin/marketplace.json");

		it("has marketplace.json at repo root", () => {
			expect(existsSync(marketplacePath)).toBe(true);
		});

		it("marketplace has required fields", () => {
			const marketplace = readJson(marketplacePath) as Record<string, unknown>;
			expect(marketplace.name).toBe("surface-protocol");
			expect(marketplace.owner).toBeDefined();
			expect(marketplace.plugins).toBeDefined();
			expect(Array.isArray(marketplace.plugins)).toBe(true);
		});

		it("marketplace plugin entry points to ./plugin", () => {
			const marketplace = readJson(marketplacePath) as {
				plugins: Array<{ name: string; source: string }>;
			};
			const entry = marketplace.plugins.find((p) => p.name === "surface");
			expect(entry).toBeDefined();
			expect(entry?.source).toBe("./plugin");
		});
	});

	describe("plugin manifest", () => {
		const manifestPath = join(PLUGIN, ".claude-plugin/plugin.json");

		it("has plugin.json in plugin/.claude-plugin/", () => {
			expect(existsSync(manifestPath)).toBe(true);
		});

		it("manifest has required fields", () => {
			const manifest = readJson(manifestPath) as Record<string, unknown>;
			expect(manifest.name).toBe("surface");
			expect(manifest.version).toBeDefined();
			expect(manifest.description).toBeDefined();
		});

		it("marketplace and plugin versions match", () => {
			const marketplace = readJson(join(ROOT, ".claude-plugin/marketplace.json")) as {
				plugins: Array<{ name: string; version: string }>;
			};
			const manifest = readJson(manifestPath) as { version: string };
			const entry = marketplace.plugins.find((p) => p.name === "surface");
			expect(entry?.version).toBe(manifest.version);
		});
	});

	describe("skills", () => {
		const skillsDir = join(PLUGIN, "skills");
		const expectedSkills = [
			"capture",
			"check",
			"implement",
			"inline",
			"learn",
			"problem",
			"quickfix",
			"ship",
		];

		it("has skills/ directory", () => {
			expect(existsSync(skillsDir)).toBe(true);
		});

		for (const skill of expectedSkills) {
			it(`has ${skill}/SKILL.md`, () => {
				expect(existsSync(join(skillsDir, skill, "SKILL.md"))).toBe(true);
			});
		}
	});

	describe("hooks", () => {
		const hooksPath = join(PLUGIN, "hooks/hooks.json");

		it("has hooks/hooks.json", () => {
			expect(existsSync(hooksPath)).toBe(true);
		});

		it("hooks reference scripts via CLAUDE_PLUGIN_ROOT", () => {
			const content = readFileSync(hooksPath, "utf-8");
			const pluginRootVar = ["$", "{CLAUDE_PLUGIN_ROOT}"].join("");
			expect(content).toContain(pluginRootVar);
			expect(content).not.toContain("../");
		});

		it("all referenced scripts exist", () => {
			const hooks = readJson(hooksPath) as {
				hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
			};
			for (const eventHooks of Object.values(hooks.hooks)) {
				for (const matcher of eventHooks) {
					for (const hook of matcher.hooks) {
						const scriptMatch = hook.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(.+?)["'\s]/);
						if (scriptMatch) {
							const scriptPath = join(PLUGIN, scriptMatch[1]);
							expect(existsSync(scriptPath), `Missing: ${scriptPath}`).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("scripts", () => {
		it("has surface-protect.sh", () => {
			expect(existsSync(join(PLUGIN, "scripts/surface-protect.sh"))).toBe(true);
		});

		it("has surface-welcome.sh", () => {
			expect(existsSync(join(PLUGIN, "scripts/surface-welcome.sh"))).toBe(true);
		});
	});

	describe("no path traversal", () => {
		it("plugin.json has no path traversal", () => {
			const content = readFileSync(join(PLUGIN, ".claude-plugin/plugin.json"), "utf-8");
			expect(content).not.toContain("../");
		});

		it("marketplace.json has no path traversal in sources", () => {
			const marketplace = readJson(join(ROOT, ".claude-plugin/marketplace.json")) as {
				plugins: Array<{ source: string }>;
			};
			for (const plugin of marketplace.plugins) {
				const source = typeof plugin.source === "string" ? plugin.source : "";
				expect(source).not.toContain("../");
			}
		});
	});
});
