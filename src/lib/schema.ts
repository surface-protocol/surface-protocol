/**
 * Surface Protocol Zod Schemas
 *
 * Runtime validation schemas for test metadata, surface map, and constraints.
 */

import { z } from "zod";

// =============================================================================
// Enums
// =============================================================================

export const TestTypeSchema = z.enum([
	"unit",
	"regression",
	"functional",
	"e2e",
	"contract",
	"performance",
	"security",
	"smoke",
]);

export const RequirementStatusSchema = z.enum([
	"pending",
	"implemented",
	"active",
	"deprecated",
	"consolidated",
	"archived",
]);

export const PlaceholderStatusSchema = z.enum([
	"not-designed",
	"in-design",
	"ready-for-implementation",
	"in-progress",
]);

export const AudienceTagSchema = z.enum(["user-facing", "admin-facing", "backend"]);

export const SourceTypeSchema = z.enum([
	"prd",
	"github",
	"jira",
	"confluence",
	"slack",
	"manual",
	"internal",
	"plan",
	"implementation",
	"implementation-discovery",
	"user-request",
]);

export const ImplementationStateSchema = z.enum(["stub", "complete", "skipped", "not-implemented"]);

export const LifecycleStageSchema = z.enum(["stub", "coded", "tested", "deployed"]);

export const ImplementationDetectionSourceSchema = z.enum([
	"yaml-status",
	"it-todo",
	"it-skip",
	"playwright-conditional-skip",
	"body-pattern",
	"no-assertions",
	"has-assertions",
]);

// =============================================================================
// Core Schemas
// =============================================================================

export const SourceReferenceSchema = z.object({
	type: SourceTypeSchema,
	ref: z.string(),
	url: z.string().url().optional(),
	obsoletes: z.boolean().optional(),
});

export const ChangeEntrySchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	commit: z.string().min(7),
	author: z.string().optional(),
	note: z.string(),
});

export const OverrideSchema = z.object({
	approved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	reason: z.string(),
	expires: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	ticket: z.string().optional(),
});

export const JourneyStepSchema = z.object({
	step: z.number().int().positive(),
	action: z.string(),
	requirement: z.string().optional(),
});

export const TestLocationSchema = z.object({
	file: z.string(),
	line: z.number().int().positive(),
	describe: z.string().optional(),
	it: z.string().optional(),
});

export const ImplementationStatusSchema = z.object({
	state: ImplementationStateSchema,
	detected_from: ImplementationDetectionSourceSchema,
	reason: z.string().optional(),
	stub_created: z.string().optional(),
	stub_commit: z.string().optional(),
});

export const LifecycleStatusSchema = z.object({
	stage: LifecycleStageSchema,
	acceptance_total: z.number().int().nonnegative(),
	acceptance_covered: z.number().int().nonnegative(),
	detected_from: z.string(),
	smoke_test: z.string().optional(),
});

// =============================================================================
// Test Metadata Schema (YAML Frontmatter)
// =============================================================================

export const TestMetadataSchema = z
	.object({
		// Identity - at least one required (validated separately)
		req: z.string().optional(),
		flow: z.string().optional(),
		contract: z.string().optional(),
		smoke: z.string().optional(),
		func: z.string().optional(),
		perf: z.string().optional(),
		sec: z.string().optional(),
		regr: z.string().optional(),

		// Core fields
		type: TestTypeSchema,
		summary: z.string().min(1),
		area: z.string().optional(),
		tags: z.array(z.string()).optional(),
		rationale: z.string().optional(),
		status: RequirementStatusSchema.optional(),

		// Acceptance criteria
		acceptance: z.array(z.string()).optional(),

		// Source reference
		source: SourceReferenceSchema.optional(),

		// Related requirements
		related: z.array(z.string()).optional(),
		conflicts_with: z.string().optional(),
		conflict_resolution: z.string().optional(),

		// Change tracking
		changed: z.array(ChangeEntrySchema).optional(),

		// Override metadata
		override_approved: z.string().optional(),
		override_reason: z.string().optional(),
		override_expires: z.string().optional(),
		override_ticket: z.string().optional(),

		// Regression-specific
		discovered: z.string().optional(),
		incident: z.string().optional(),
		rootcause: z.string().optional(),
		learning: z.string().optional(),
		consolidated_into: z.string().optional(),

		// E2E-specific
		verifies: z.array(z.string()).optional(),
		externals: z.array(z.string()).optional(),
		journey: z.array(JourneyStepSchema).optional(),

		// Contract-specific
		provider: z.string().optional(),
		consumer: z.string().optional(),
		schema: z.record(z.string(), z.string()).optional(),
		breaking_change_policy: z.string().optional(),

		// Performance-specific
		baseline: z.string().optional(),
		target: z.string().optional(),
		ceiling: z.string().optional(),
		load_profile: z.string().optional(),

		// Security-specific
		owasp: z.string().optional(),
		attack_vector: z.string().optional(),
		mitigation: z.string().optional(),

		// Smoke-specific
		criticality: z.string().optional(),
		checks: z.array(z.string()).optional(),
		timeout: z.string().optional(),

		// Functional-specific
		component: z.string().optional(),
		accepts: z.array(z.string()).optional(),
		rejects: z.array(z.string()).optional(),

		// Placeholder-specific
		placeholder: z.string().optional(),
		description: z.string().optional(),
		interaction: z.string().optional(),
		blocked_by: z.string().optional(),
		figma_id: z.string().optional(),

		// Flaky test handling
		flaky: z.boolean().optional(),
		flaky_reason: z.string().optional(),
		flaky_since: z.string().optional(),

		// Audience impact
		audience: AudienceTagSchema.optional(),
	})
	.refine(
		(data) =>
			Boolean(
				data.req ||
					data.flow ||
					data.contract ||
					data.smoke ||
					data.func ||
					data.perf ||
					data.sec ||
					data.regr,
			),
		{
			message:
				"At least one identifier is required: req, flow, contract, smoke, func, perf, sec, or regr",
		},
	);

// =============================================================================
// Surface Map Schemas
// =============================================================================

export const RequirementSchema = z.object({
	id: z.string(),
	type: TestTypeSchema,
	area: z.string().optional(),
	summary: z.string(),
	description: z.string().optional(),
	rationale: z.string().optional(),
	tags: z.array(z.string()),
	acceptance: z.array(z.string()).optional(),
	source: SourceReferenceSchema.optional(),
	location: TestLocationSchema,
	related: z.array(z.string()).optional(),
	conflicts: z.array(z.string()).optional(),
	changed: z.array(ChangeEntrySchema),
	authors: z.array(z.string()),
	created: z.string(),
	last_modified: z.string(),
	status: RequirementStatusSchema,
	override: OverrideSchema.nullable(),
	flaky: z.boolean(),
	audience: AudienceTagSchema.optional(),

	// Implementation status
	implementation: ImplementationStatusSchema.optional(),

	// Lifecycle stage
	lifecycle: LifecycleStatusSchema.optional(),

	// Regression-specific
	discovered: z.string().optional(),
	incident: z.string().optional(),
	rootcause: z.string().optional(),
	learning: z.string().optional(),
	consolidated_into: z.string().nullable().optional(),
});

export const PlaceholderSchema = z.object({
	component: z.string(),
	status: PlaceholderStatusSchema,
	created: z.string(),
	figma_id: z.string().nullable().optional(),
	description: z.string().optional(),
	interaction: z.string().optional(),
	blocked_by: z.string().optional(),
});

export const CoverageGapSchema = z.object({
	file: z.string(),
	reason: z.string(),
	line: z.number().optional(),
});

export const SurfaceMapStatsSchema = z.object({
	total: z.number().int().nonnegative(),
	by_type: z.record(TestTypeSchema, z.number()),
	by_area: z.record(z.string(), z.number()),
	by_tag: z.record(z.string(), z.number()),
	coverage: z.object({
		with_metadata: z.number().int().nonnegative(),
		without_metadata: z.number().int().nonnegative(),
	}),
});

export const SurfaceMapSchema = z.object({
	generated: z.string().datetime(),
	version: z.string(),
	stats: SurfaceMapStatsSchema,
	requirements: z.array(RequirementSchema),
	regressions: z.array(RequirementSchema),
	flows: z.array(RequirementSchema),
	contracts: z.array(RequirementSchema),
	smoke: z.array(RequirementSchema),
	placeholders: z.array(PlaceholderSchema),
	gaps: z.array(CoverageGapSchema),
});

// =============================================================================
// Constraint Schemas
// =============================================================================

export const ComponentConstraintsSchema = z.object({
	allowed_sources: z.array(
		z.object({
			source: z.enum(["figma", "shadcn", "radix", "custom"]),
			url: z.string().url().optional(),
			components: z.array(z.string()).optional(),
		}),
	),
	forbidden: z.array(z.string()),
	placeholder_required_for: z.array(z.string()).optional(),
});

export const PatternConstraintsSchema = z.object({
	allowed: z.array(z.string()),
	forbidden: z.array(z.string()),
});

export const DependencyConstraintsSchema = z.object({
	allowed: z.record(z.string(), z.array(z.string())),
	forbidden: z.array(z.string()),
});

export const ArchitectureConstraintsSchema = z.object({
	rules: z.array(z.string()),
});

export const ConstraintsSchema = z.object({
	components: ComponentConstraintsSchema.optional(),
	patterns: PatternConstraintsSchema.optional(),
	dependencies: DependencyConstraintsSchema.optional(),
	architecture: ArchitectureConstraintsSchema.optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type TestMetadataInput = z.input<typeof TestMetadataSchema>;
export type TestMetadataOutput = z.output<typeof TestMetadataSchema>;
export type SurfaceMapInput = z.input<typeof SurfaceMapSchema>;
export type ConstraintsInput = z.input<typeof ConstraintsSchema>;
