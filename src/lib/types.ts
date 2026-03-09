/**
 * Surface Protocol Type Definitions
 *
 * Core types for the Surface Protocol tooling. These types define the
 * structure of test metadata, requirements, constraints, and the surface map.
 */

// =============================================================================
// Test Types
// =============================================================================

export type TestType =
	| "unit"
	| "regression"
	| "functional"
	| "e2e"
	| "contract"
	| "performance"
	| "security"
	| "smoke";

export type RequirementStatus =
	| "pending"
	| "implemented"
	| "active"
	| "deprecated"
	| "consolidated"
	| "archived";

// =============================================================================
// Implementation Status
// =============================================================================

/**
 * The detected implementation state of a test.
 * - stub: Test exists but has no real implementation (empty body, no assertions)
 * - complete: Test has actual assertions and implementation
 * - skipped: Test is explicitly skipped via it.skip()
 * - not-implemented: Test throws NOT IMPLEMENTED or similar
 */
export type ImplementationState = "stub" | "complete" | "skipped" | "not-implemented";

/**
 * Sources that can trigger implementation status detection.
 * Priority order (highest to lowest):
 * 1. yaml-status - Explicit status: pending in YAML metadata
 * 2. it-todo - Test defined with it.todo()
 * 3. it-skip - Test defined with it.skip()
 * 4. body-pattern - Body contains NOT IMPLEMENTED throw
 * 5. no-assertions - Test body has no expect/assert calls
 * 6. has-assertions - Test body has expect/assert calls (complete)
 */
export type ImplementationDetectionSource =
	| "yaml-status"
	| "it-todo"
	| "it-skip"
	| "playwright-conditional-skip"
	| "body-pattern"
	| "no-assertions"
	| "has-assertions";

/**
 * Implementation status information for a test.
 */
export interface ImplementationStatus {
	/** The detected implementation state */
	state: ImplementationState;
	/** How the state was detected */
	detected_from: ImplementationDetectionSource;
	/** Optional reason/details about the detection */
	reason?: string;
	/** Date the stub was created (from git history or YAML) */
	stub_created?: string;
	/** Git commit when stub was created */
	stub_commit?: string;
}

export type PlaceholderStatus =
	| "not-designed"
	| "in-design"
	| "ready-for-implementation"
	| "in-progress";

// =============================================================================
// Lifecycle Stage
// =============================================================================

/**
 * The lifecycle stage of a requirement, from capture to deployment.
 * - stub: Requirement captured, test is placeholder (.skip, .todo, no assertions)
 * - coded: Implementation exists, test has real assertions but not all acceptance criteria covered
 * - tested: All acceptance criteria have corresponding passing assertions
 * - deployed: Live in production with passing SMOKE test or deployment marker
 */
export type LifecycleStage = "stub" | "coded" | "tested" | "deployed";

/**
 * Lifecycle status information for a requirement.
 */
export interface LifecycleStatus {
	/** Current lifecycle stage */
	stage: LifecycleStage;
	/** Total acceptance criteria from YAML metadata */
	acceptance_total: number;
	/** Number of acceptance criteria with corresponding assertions */
	acceptance_covered: number;
	/** How the stage was determined */
	detected_from: string;
	/** SMOKE-* test ID if deployed */
	smoke_test?: string;
}

export type ImpactLevel = "SAFE" | "DANGEROUS";

export type AudienceTag = "user-facing" | "admin-facing" | "backend";

// Tags that trigger DANGEROUS classification
export const DANGEROUS_TAGS = ["critical", "compliance", "security", "blocking"] as const;
export type DangerousTag = (typeof DANGEROUS_TAGS)[number];

// =============================================================================
// Source References
// =============================================================================

export interface SourceReference {
	type:
		| "prd"
		| "github"
		| "jira"
		| "confluence"
		| "slack"
		| "manual"
		| "internal"
		| "plan"
		| "implementation"
		| "implementation-discovery"
		| "user-request";
	ref: string;
	url?: string;
	obsoletes?: boolean;
}

// =============================================================================
// Change History
// =============================================================================

export interface ChangeEntry {
	date: string; // ISO 8601 date
	commit: string; // Git commit hash (short or full)
	author?: string; // Git author
	note: string; // Description of change
}

// =============================================================================
// Override Metadata
// =============================================================================

export interface Override {
	approved: string; // ISO 8601 date
	reason: string;
	expires?: string | undefined; // ISO 8601 date
	ticket?: string | undefined; // Link to approval ticket
}

// =============================================================================
// Test Metadata (YAML Frontmatter)
// =============================================================================

export interface TestMetadata {
	// Identity - one of these is required
	req?: string; // REQ-XXX for unit/functional tests
	flow?: string; // FLOW-XXX for e2e tests
	contract?: string; // CONTRACT-XXX for contract tests
	smoke?: string; // SMOKE-XXX for smoke tests

	// Core fields
	type: TestType;
	summary: string;
	area?: string;
	tags?: string[];
	rationale?: string;
	status?: RequirementStatus;

	// Acceptance criteria
	acceptance?: string[];

	// Source reference
	source?: SourceReference;

	// Related requirements
	related?: string[];
	conflicts_with?: string;
	conflict_resolution?: string;

	// Change tracking
	changed?: ChangeEntry[];

	// Override metadata
	override_approved?: string;
	override_reason?: string;
	override_expires?: string;
	override_ticket?: string;

	// Regression-specific
	discovered?: string; // Date bug was found
	incident?: string; // Incident ID
	rootcause?: string;
	learning?: string;
	consolidated_into?: string;

	// E2E-specific
	verifies?: string[]; // REQ IDs this flow verifies
	externals?: string[]; // External services involved
	journey?: JourneyStep[];

	// Contract-specific
	provider?: string;
	consumer?: string;
	schema?: Record<string, string>;
	breaking_change_policy?: string;

	// Performance-specific
	baseline?: string;
	target?: string;
	ceiling?: string;
	load_profile?: string;

	// Security-specific
	owasp?: string;
	attack_vector?: string;
	mitigation?: string;

	// Smoke-specific
	criticality?: string;
	checks?: string[];
	timeout?: string;

	// Functional-specific
	component?: string;
	accepts?: string[];
	rejects?: string[];

	// Placeholder-specific
	placeholder?: string;
	description?: string;
	interaction?: string;
	blocked_by?: string;
	figma_id?: string;

	// Flaky test handling
	flaky?: boolean;
	flaky_reason?: string;
	flaky_since?: string;

	// Audience impact
	audience?: AudienceTag;
}

export interface JourneyStep {
	step: number;
	action: string;
	requirement?: string;
}

// =============================================================================
// Parsed Test
// =============================================================================

export interface TestLocation {
	file: string;
	line: number;
	describe?: string | undefined;
	it?: string | undefined;
}

export interface ParsedTest {
	metadata: TestMetadata;
	location: TestLocation;
	raw: string; // Raw YAML content
	/** Implementation status - tracks if test is stub, complete, skipped, etc. */
	implementation?: ImplementationStatus | undefined;
	/** Lifecycle stage - tracks progression from stub to deployed */
	lifecycle?: LifecycleStatus | undefined;
}

// =============================================================================
// Requirements in Surface Map
// =============================================================================

export interface Requirement {
	id: string; // REQ-XXX, FLOW-XXX, etc.
	type: TestType;
	area?: string | undefined;
	summary: string;
	description?: string | undefined;
	rationale?: string | undefined;
	tags: string[];
	acceptance?: string[] | undefined;
	source?: SourceReference | undefined;
	location: TestLocation;
	related?: string[] | undefined;
	conflicts?: string[] | undefined;
	changed: ChangeEntry[];
	authors: string[];
	created: string;
	last_modified: string;
	status: RequirementStatus;
	override: Override | null;
	flaky: boolean;
	audience?: AudienceTag | undefined;

	/** Implementation status - tracks if test is stub, complete, skipped, etc. */
	implementation?: ImplementationStatus | undefined;

	/** Lifecycle stage - tracks progression from stub to deployed */
	lifecycle?: LifecycleStatus | undefined;

	// Regression-specific
	discovered?: string | undefined;
	incident?: string | undefined;
	rootcause?: string | undefined;
	learning?: string | undefined;
	consolidated_into?: string | undefined;
}

// =============================================================================
// Placeholder
// =============================================================================

export interface Placeholder {
	component: string;
	status: PlaceholderStatus;
	created: string;
	figma_id?: string | undefined;
	description?: string | undefined;
	interaction?: string | undefined;
	blocked_by?: string | undefined;
}

// =============================================================================
// Coverage Gap
// =============================================================================

export interface CoverageGap {
	file: string;
	reason: string;
	line?: number;
}

// =============================================================================
// Surface Map (surface.json)
// =============================================================================

export interface SurfaceMapStats {
	total: number;
	by_type: Record<TestType, number>;
	by_area: Record<string, number>;
	by_tag: Record<string, number>;
	coverage: {
		with_metadata: number;
		without_metadata: number;
	};
}

export interface SurfaceMap {
	generated: string; // ISO 8601 timestamp
	version: string; // Protocol version
	stats: SurfaceMapStats;
	requirements: Requirement[];
	regressions: Requirement[];
	flows: Requirement[];
	contracts: Requirement[];
	placeholders: Placeholder[];
	gaps: CoverageGap[];
}

// =============================================================================
// Constraints
// =============================================================================

export interface ComponentConstraints {
	allowed_sources: Array<{
		source: "figma" | "shadcn" | "radix" | "custom";
		url?: string;
		components?: string[];
	}>;
	forbidden: string[];
	placeholder_required_for?: string[];
}

export interface PatternConstraints {
	allowed: string[];
	forbidden: string[];
}

export interface DependencyConstraints {
	allowed: Record<string, string[]>;
	forbidden: string[];
}

export interface ArchitectureConstraints {
	rules: string[];
}

export interface Constraints {
	components?: ComponentConstraints;
	patterns?: PatternConstraints;
	dependencies?: DependencyConstraints;
	architecture?: ArchitectureConstraints;
}

// =============================================================================
// Ingestion Inputs
// =============================================================================

export type SourceKind = SourceReference["type"];

/** Input for capturing a new requirement */
export interface CaptureInput {
	dir: string;
	summary: string;
	area?: string;
	acceptance: string[];
	sourceKind: SourceKind;
	sourceRef: string;
	sourceUrl?: string;
	kind?: "capture" | "problem";
}

/** Input for persisting a learning */
export interface LearnInput {
	dir: string;
	title: string;
	summary: string;
	sourceKind?: SourceKind;
	sourceRef?: string;
	insights?: string[];
	fileName?: string;
}

/** Input for rendering a test stub from an adapter */
export interface StubRenderInput {
	id: string;
	summary: string;
	area?: string;
	acceptance: string[];
	source: SourceReference;
	date: string;
	requirementDir?: string;
	kind: "capture" | "problem";
}

// =============================================================================
// Validation Results
// =============================================================================

export interface ValidationError {
	file: string;
	line?: number | undefined;
	field?: string | undefined;
	message: string;
	severity: "error" | "warning";
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationError[];
}

// =============================================================================
// Coverage Report
// =============================================================================

export interface CoverageReport {
	total_tests: number;
	with_metadata: number;
	without_metadata: number;
	coverage_percent: number;
	by_type: Record<TestType, number>;
	by_area: Record<string, number>;
	dangerous_count: number;
	override_count: number;
	flaky_count: number;
	placeholder_count: number;
	gaps: CoverageGap[];
}

// =============================================================================
// Query Results
// =============================================================================

export interface QueryResult {
	requirements: Requirement[];
	total: number;
	dangerous: boolean;
	dangerous_requirements: string[];
}

// =============================================================================
// Adoption Metrics Types
// =============================================================================

/** Whether a commit flowed through Surface Protocol or bypassed it */
export type CommitClassification = "surface-routed" | "bypass";

/** How we determined a commit was surface-routed */
export type RoutedSignal =
	| "trailer-capture"
	| "trailer-implement"
	| "trailer-ship"
	| "trailer-quickfix"
	| "trailer-problem"
	| "affects-trailer"
	| "req-id-in-subject"
	| "heuristic";

/** Category of bypass commit */
export type BypassCategory = "ci-infra" | "docs" | "config" | "test" | "unknown";

/** A single classified commit */
export interface ClassifiedCommit {
	hash: string;
	author: string;
	date: string;
	type: string;
	scope: string;
	summary: string;
	classification: CommitClassification;
	signal: RoutedSignal | null;
	bypass_category: BypassCategory | null;
}

/** Aggregated adoption metrics report */
export interface AdoptionReport {
	period: { since: string; until: string };
	totals: { commits: number; routed: number; bypass: number };
	rates: { adoption_percent: number };
	breakdowns: {
		by_signal: Record<string, number>;
		by_author: Record<string, { routed: number; bypass: number }>;
		by_bypass_category: Record<string, number>;
	};
	weekly_trend: Array<{
		week: string;
		routed: number;
		bypass: number;
		adoption_percent: number;
	}>;
}
