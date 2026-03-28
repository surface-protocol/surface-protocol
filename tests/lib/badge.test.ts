import { describe, expect, it } from "vitest";
import {
	allBadgeSnippets,
	BADGE_LOGO_BASE64,
	buildBadgeEndpoint,
	coverageColor,
	coveragePercent,
	customBadgeMarkdown,
	customBadgeUrl,
	endpointBadgeMarkdown,
	endpointBadgeUrl,
	shieldsBadgeMarkdown,
	shieldsBadgeUrl,
} from "../../src/lib/badge.js";
import type { SurfaceMapStats } from "../../src/lib/types.js";

// =============================================================================
// coverageColor
// =============================================================================

describe("coverageColor", () => {
	it("returns brightgreen for 90%+", () => {
		expect(coverageColor(90)).toBe("brightgreen");
		expect(coverageColor(100)).toBe("brightgreen");
	});

	it("returns green for 75-89%", () => {
		expect(coverageColor(75)).toBe("green");
		expect(coverageColor(89)).toBe("green");
	});

	it("returns yellow for 50-74%", () => {
		expect(coverageColor(50)).toBe("yellow");
		expect(coverageColor(74)).toBe("yellow");
	});

	it("returns orange for 25-49%", () => {
		expect(coverageColor(25)).toBe("orange");
		expect(coverageColor(49)).toBe("orange");
	});

	it("returns red for below 25%", () => {
		expect(coverageColor(0)).toBe("red");
		expect(coverageColor(24)).toBe("red");
	});
});

// =============================================================================
// coveragePercent
// =============================================================================

describe("coveragePercent", () => {
	it("computes percentage from stats", () => {
		const stats = makeStats(80, 20);
		expect(coveragePercent(stats)).toBe(80);
	});

	it("returns 0 when no tests exist", () => {
		const stats = makeStats(0, 0);
		expect(coveragePercent(stats)).toBe(0);
	});

	it("rounds to nearest integer", () => {
		const stats = makeStats(1, 2);
		expect(coveragePercent(stats)).toBe(33);
	});
});

// =============================================================================
// buildBadgeEndpoint
// =============================================================================

describe("buildBadgeEndpoint", () => {
	it("returns valid shields.io endpoint JSON", () => {
		const stats = makeStats(9, 1);
		const endpoint = buildBadgeEndpoint(stats);

		expect(endpoint.schemaVersion).toBe(1);
		expect(endpoint.label).toBe("surface coverage");
		expect(endpoint.message).toBe("90%");
		expect(endpoint.color).toBe("brightgreen");
	});

	it("uses correct color for low coverage", () => {
		const stats = makeStats(1, 9);
		const endpoint = buildBadgeEndpoint(stats);
		expect(endpoint.message).toBe("10%");
		expect(endpoint.color).toBe("red");
	});
});

// =============================================================================
// Badge URLs
// =============================================================================

describe("shieldsBadgeUrl", () => {
	it("includes brand color and base64 logo", () => {
		const url = shieldsBadgeUrl();
		expect(url).toContain("6C3CE1");
		expect(url).toContain("logo=data:image/svg");
		expect(url).toContain(BADGE_LOGO_BASE64);
	});
});

describe("customBadgeUrl", () => {
	it("points to raw.githubusercontent.com", () => {
		const url = customBadgeUrl();
		expect(url).toContain("raw.githubusercontent.com");
		expect(url).toContain("built-with-surface-protocol.svg");
	});
});

describe("endpointBadgeUrl", () => {
	it("builds shields.io endpoint URL for a repo", () => {
		const url = endpointBadgeUrl("acme", "my-app");
		expect(url).toContain("img.shields.io/endpoint");
		expect(url).toContain("acme");
		expect(url).toContain("my-app");
		expect(url).toContain("surface-badge.json");
	});

	it("supports custom branch", () => {
		const url = endpointBadgeUrl("acme", "my-app", "develop");
		expect(url).toContain("develop");
	});
});

// =============================================================================
// Markdown snippets
// =============================================================================

describe("shieldsBadgeMarkdown", () => {
	it("produces valid markdown image link", () => {
		const md = shieldsBadgeMarkdown();
		expect(md).toMatch(/^\[!\[Built with Surface Protocol\]\(.+\)\]\(.+\)$/);
		expect(md).toContain("github.com/surface-protocol/surface-protocol");
	});
});

describe("customBadgeMarkdown", () => {
	it("produces valid markdown image link", () => {
		const md = customBadgeMarkdown();
		expect(md).toMatch(/^\[!\[Built with Surface Protocol\]\(.+\)\]\(.+\)$/);
	});
});

describe("endpointBadgeMarkdown", () => {
	it("produces valid markdown image link", () => {
		const md = endpointBadgeMarkdown("acme", "my-app");
		expect(md).toMatch(/^\[!\[Surface Coverage\]\(.+\)\]\(.+\)$/);
	});
});

describe("allBadgeSnippets", () => {
	it("includes shields and custom badges without repo info", () => {
		const output = allBadgeSnippets();
		expect(output).toContain("Static badge");
		expect(output).toContain("Custom gradient badge");
		expect(output).not.toContain("Dynamic coverage badge");
	});

	it("includes endpoint badge when repo info provided", () => {
		const output = allBadgeSnippets("acme", "my-app");
		expect(output).toContain("Dynamic coverage badge");
		expect(output).toContain("acme");
	});
});

// =============================================================================
// Helpers
// =============================================================================

function makeStats(withMeta: number, withoutMeta: number): SurfaceMapStats {
	return {
		total: withMeta,
		by_type: {
			unit: withMeta,
			regression: 0,
			functional: 0,
			e2e: 0,
			contract: 0,
			performance: 0,
			security: 0,
			smoke: 0,
		},
		by_area: {},
		by_tag: {},
		coverage: {
			with_metadata: withMeta,
			without_metadata: withoutMeta,
		},
	};
}
