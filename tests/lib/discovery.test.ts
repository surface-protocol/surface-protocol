import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../src/lib/discovery/index.js";
import { getAllDiscoveryAdapters } from "../../src/lib/discovery/adapter.js";
import { inferArea } from "../../src/lib/backfill.js";

// =============================================================================
// Discovery adapter registry
// =============================================================================

describe("discovery adapter registry", () => {
	it("has all built-in adapters registered", () => {
		const adapters = getAllDiscoveryAdapters();
		const names = adapters.map((a) => a.name);
		expect(names).toContain("package-scripts");
		expect(names).toContain("hono-routes");
		expect(names).toContain("astro-pages");
		expect(names).toContain("commander-cli");
		expect(names).toContain("rails-routes");
		expect(names).toContain("graphql-schema");
	});
});

// =============================================================================
// package-scripts adapter
// =============================================================================

describe("package-scripts adapter", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "sp-discovery-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("detects project with package.json", async () => {
		writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }));
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "package-scripts")!;
		expect(await adapter.detect(tmpDir)).toBe(true);
	});

	it("returns false for project without package.json", async () => {
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "package-scripts")!;
		expect(await adapter.detect(tmpDir)).toBe(false);
	});

	it("discovers all scripts from package.json", async () => {
		writeFileSync(
			join(tmpDir, "package.json"),
			JSON.stringify({
				scripts: {
					build: "tsc",
					test: "vitest",
					dev: "vite",
				},
			}),
		);
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "package-scripts")!;
		const eps = await adapter.discover(tmpDir);
		const names = eps.map((ep) => ep.path);
		expect(names).toContain("build");
		expect(names).toContain("test");
		expect(names).toContain("dev");
	});

	it("sets type to 'script' for all entries", async () => {
		writeFileSync(
			join(tmpDir, "package.json"),
			JSON.stringify({ scripts: { build: "tsc" } }),
		);
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "package-scripts")!;
		const eps = await adapter.discover(tmpDir);
		for (const ep of eps) {
			expect(ep.type).toBe("script");
		}
	});
});

// =============================================================================
// astro-pages adapter
// =============================================================================

describe("astro-pages adapter", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "sp-astro-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("detects project with src/pages directory", async () => {
		mkdirSync(join(tmpDir, "src/pages"), { recursive: true });
		writeFileSync(join(tmpDir, "src/pages/index.astro"), "---\n---\n<h1>Hello</h1>");
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "astro-pages")!;
		expect(await adapter.detect(tmpDir)).toBe(true);
	});

	it("discovers page routes from src/pages", async () => {
		mkdirSync(join(tmpDir, "src/pages/auth"), { recursive: true });
		writeFileSync(join(tmpDir, "src/pages/index.astro"), "---\n---");
		writeFileSync(join(tmpDir, "src/pages/about.astro"), "---\n---");
		writeFileSync(join(tmpDir, "src/pages/auth/login.astro"), "---\n---");

		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "astro-pages")!;
		const eps = await adapter.discover(tmpDir);
		const paths = eps.map((ep) => ep.path);

		expect(paths).toContain("/");
		expect(paths).toContain("/about");
		expect(paths).toContain("/auth/login");
	});

	it("sets type to 'page'", async () => {
		mkdirSync(join(tmpDir, "src/pages"), { recursive: true });
		writeFileSync(join(tmpDir, "src/pages/index.astro"), "");
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "astro-pages")!;
		const eps = await adapter.discover(tmpDir);
		for (const ep of eps) {
			expect(ep.type).toBe("page");
		}
	});
});

// =============================================================================
// rails-routes adapter
// =============================================================================

describe("rails-routes adapter", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "sp-rails-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("detects Rails project via config/routes.rb", async () => {
		mkdirSync(join(tmpDir, "config"), { recursive: true });
		writeFileSync(join(tmpDir, "config/routes.rb"), "Rails.application.routes.draw do\nend");
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "rails-routes")!;
		expect(await adapter.detect(tmpDir)).toBe(true);
	});

	it("discovers explicit verb routes", async () => {
		mkdirSync(join(tmpDir, "config"), { recursive: true });
		writeFileSync(
			join(tmpDir, "config/routes.rb"),
			`Rails.application.routes.draw do
  get '/health', to: 'application#health'
  post '/api/login', to: 'sessions#create'
end`,
		);
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "rails-routes")!;
		const eps = await adapter.discover(tmpDir);
		const paths = eps.map((ep) => `${ep.method} ${ep.path}`);
		expect(paths).toContain("GET /health");
		expect(paths).toContain("POST /api/login");
	});

	it("expands resources :name into REST routes", async () => {
		mkdirSync(join(tmpDir, "config"), { recursive: true });
		writeFileSync(
			join(tmpDir, "config/routes.rb"),
			"Rails.application.routes.draw do\n  resources :users\nend",
		);
		const adapter = getAllDiscoveryAdapters().find((a) => a.name === "rails-routes")!;
		const eps = await adapter.discover(tmpDir);
		const methods = eps.map((ep) => ep.method);
		expect(methods).toContain("GET");
		expect(methods).toContain("POST");
		expect(methods).toContain("DELETE");
	});
});
