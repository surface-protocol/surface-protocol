/**
 * Surface Protocol — Core Library
 *
 * Tests are the spec. surface.json is the queryable truth.
 *
 * @module @surface-protocol/cli
 */

// Commit Classifier
export {
	buildClassifiedCommit,
	categorizeBypass,
	classifyCommit,
	extractSurfaceTrailer,
	parseCommitLine,
	parseConventionalCommit,
} from "./commit-classifier.js";
// Implementation Detection
export {
	buildSmokeVerificationMap,
	countByLifecycleStage,
	countByState,
	detectImplementationStatus,
	detectImplementationStatusBatch,
	detectLifecycleStage,
	getLifecycleDescription,
	getStateDescription,
	isIncomplete,
	isRunnable,
	promoteToDeployed,
} from "./detect-implementation-status.js";
// Formatters
export {
	formatBox,
	formatCoverageReport,
	formatFeatureDoc,
	formatJson,
	formatMarkdown,
	formatRequirementsList,
	formatStatus,
	formatTable,
	formatValidationErrors,
	groupRequirementsByArea,
	normalizeAcceptance,
} from "./formatters.js";
// Parser
export {
	extractAllYamlBlocks,
	extractRequirementId,
	extractYamlFrontmatter,
	getMissingFields,
	getRequirementCategory,
	hasRequiredFields,
	parseDirectory,
	parseTestFile,
	parseTestFileContent,
	parseTestFileContentBasic,
} from "./parser.js";
// Schemas
export {
	ConstraintsSchema,
	RequirementStatusSchema,
	SurfaceMapSchema,
	TestMetadataSchema,
	TestTypeSchema,
} from "./schema.js";
// Selector Contract
export type { SurfaceSelector } from "./selector-contract.js";
export {
	buildSelectorAttributes,
	explainSelectorContract,
	validateActionId,
	validateComponentId,
} from "./selector-contract.js";
// Types
export type {
	AdoptionReport,
	AudienceTag,
	BypassCategory,
	ChangeEntry,
	ClassifiedCommit,
	CommitClassification,
	Conflict,
	Constraints,
	CoverageGap,
	CoverageReport,
	DangerousTag,
	HookOutput,
	ImpactLevel,
	ImplementationDetectionSource,
	ImplementationState,
	ImplementationStatus,
	JourneyStep,
	LifecycleStage,
	LifecycleStatus,
	Override,
	ParsedTest,
	Placeholder,
	PlaceholderStatus,
	QueryResult,
	Requirement,
	RequirementStatus,
	RoutedSignal,
	SourceReference,
	SurfaceMap,
	SurfaceMapStats,
	TestLocation,
	TestMetadata,
	TestType,
	ToolOutput,
	ValidationError,
	ValidationResult,
} from "./types.js";
export { DANGEROUS_TAGS } from "./types.js";
// Validators
export {
	getDangerousTags,
	isDangerous,
	isOverrideExpired,
	validateConstraints,
	validateFrontmatter,
	validateFrontmatterWithContext,
	validateSurfaceMap,
	validateTestMetadata,
} from "./validators.js";
