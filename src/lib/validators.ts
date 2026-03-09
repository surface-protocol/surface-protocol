/**
 * Surface Protocol Validators
 *
 * Validation functions for test metadata, surface maps, and constraints.
 */

import { ConstraintsSchema, SurfaceMapSchema, TestMetadataSchema } from "./schema.js";
import type { TestMetadata, ValidationError, ValidationResult } from "./types.js";
import { DANGEROUS_TAGS } from "./types.js";

// =============================================================================
// Frontmatter Validation
// =============================================================================

/**
 * Validates test metadata against the schema.
 */
export function validateFrontmatter(yaml: unknown): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	const result = TestMetadataSchema.safeParse(yaml);

	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push({
				file: "",
				field: issue.path.join("."),
				message: issue.message,
				severity: "error",
			});
		}
		return { valid: false, errors, warnings };
	}

	// Additional validation: check for recommended fields
	const data = result.data;

	if (!data.rationale) {
		warnings.push({
			file: "",
			field: "rationale",
			message: "Missing rationale - WHY is this requirement important?",
			severity: "warning",
		});
	}

	if (!data.tags || data.tags.length === 0) {
		warnings.push({
			file: "",
			field: "tags",
			message: "No tags specified - consider adding searchable categories",
			severity: "warning",
		});
	}

	if (!data.area) {
		warnings.push({
			file: "",
			field: "area",
			message: "No area specified - consider categorizing by codebase area",
			severity: "warning",
		});
	}

	return { valid: true, errors, warnings };
}

/**
 * Validates test metadata with file context.
 */
export function validateFrontmatterWithContext(
	yaml: unknown,
	file: string,
	line?: number,
): ValidationResult {
	const result = validateFrontmatter(yaml);

	// Add file context to all errors and warnings
	for (const error of result.errors) {
		error.file = file;
		error.line = line;
	}
	for (const warning of result.warnings) {
		warning.file = file;
		warning.line = line;
	}

	return result;
}

// =============================================================================
// Surface Map Validation
// =============================================================================

/**
 * Validates a complete surface map.
 */
export function validateSurfaceMap(map: unknown): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	const result = SurfaceMapSchema.safeParse(map);

	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push({
				file: "surface.json",
				field: issue.path.join("."),
				message: issue.message,
				severity: "error",
			});
		}
		return { valid: false, errors, warnings };
	}

	// Additional validation: check for issues
	const data = result.data;

	// Check for duplicate IDs
	const ids = new Set<string>();
	const allRequirements = [
		...data.requirements,
		...data.regressions,
		...data.flows,
		...data.contracts,
	];

	for (const req of allRequirements) {
		if (ids.has(req.id)) {
			errors.push({
				file: "surface.json",
				field: `requirements[${req.id}]`,
				message: `Duplicate requirement ID: ${req.id}`,
				severity: "error",
			});
		}
		ids.add(req.id);
	}

	// Check for gaps
	if (data.gaps.length > 0) {
		warnings.push({
			file: "surface.json",
			field: "gaps",
			message: `${data.gaps.length} test file(s) without metadata`,
			severity: "warning",
		});
	}

	return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// Constraint Validation
// =============================================================================

/**
 * Validates a constraints file.
 */
export function validateConstraints(constraints: unknown): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	const result = ConstraintsSchema.safeParse(constraints);

	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push({
				file: "constraints.json",
				field: issue.path.join("."),
				message: issue.message,
				severity: "error",
			});
		}
		return { valid: false, errors, warnings };
	}

	return { valid: true, errors, warnings };
}

// =============================================================================
// Impact Classification
// =============================================================================

const DANGEROUS_TAG_SET = new Set<string>(DANGEROUS_TAGS);

/**
 * Checks if a requirement is classified as DANGEROUS.
 */
export function isDangerous(metadata: TestMetadata): boolean {
	if (!metadata.tags) return false;
	return metadata.tags.some((tag) => DANGEROUS_TAG_SET.has(tag));
}

/**
 * Gets the list of dangerous tags present in metadata.
 */
export function getDangerousTags(metadata: TestMetadata): string[] {
	if (!metadata.tags) return [];
	return metadata.tags.filter((tag) => DANGEROUS_TAG_SET.has(tag));
}

// =============================================================================
// Override Validation
// =============================================================================

/**
 * Checks if an override has expired.
 */
export function isOverrideExpired(overrideExpires: string | undefined): boolean {
	if (!overrideExpires) return false;

	const expiryDate = new Date(overrideExpires);
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	return expiryDate < today;
}

/**
 * Validates override metadata.
 */
export function validateOverride(metadata: TestMetadata): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	if (metadata.override_approved) {
		if (!metadata.override_reason) {
			errors.push({
				file: "",
				field: "override_reason",
				message: "Override approved but no reason provided - this is required for audit trail",
				severity: "error",
			});
		}

		if (isOverrideExpired(metadata.override_expires)) {
			warnings.push({
				file: "",
				field: "override_expires",
				message: `Override expired on ${metadata.override_expires} - should be reviewed`,
				severity: "warning",
			});
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// Flaky Test Validation
// =============================================================================

/**
 * Validates flaky test metadata.
 */
export function validateFlakyTest(metadata: TestMetadata): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	if (metadata.flaky) {
		if (!metadata.flaky_reason) {
			warnings.push({
				file: "",
				field: "flaky_reason",
				message: "Flaky test without reason - document why it's flaky",
				severity: "warning",
			});
		}

		if (!metadata.flaky_since) {
			warnings.push({
				file: "",
				field: "flaky_since",
				message: "Flaky test without date - track when it became flaky",
				severity: "warning",
			});
		}
	}

	return { valid: true, errors, warnings };
}

// =============================================================================
// Comprehensive Validation
// =============================================================================

/**
 * Runs all validations on test metadata.
 */
export function validateTestMetadata(
	metadata: TestMetadata,
	file: string,
	line?: number,
): ValidationResult {
	const allErrors: ValidationError[] = [];
	const allWarnings: ValidationError[] = [];

	// Schema validation
	const schemaResult = validateFrontmatterWithContext(metadata, file, line);
	allErrors.push(...schemaResult.errors);
	allWarnings.push(...schemaResult.warnings);

	// Override validation
	const overrideResult = validateOverride(metadata);
	for (const error of overrideResult.errors) {
		error.file = file;
		error.line = line;
	}
	for (const warning of overrideResult.warnings) {
		warning.file = file;
		warning.line = line;
	}
	allErrors.push(...overrideResult.errors);
	allWarnings.push(...overrideResult.warnings);

	// Flaky test validation
	const flakyResult = validateFlakyTest(metadata);
	for (const warning of flakyResult.warnings) {
		warning.file = file;
		warning.line = line;
	}
	allWarnings.push(...flakyResult.warnings);

	return {
		valid: allErrors.length === 0,
		errors: allErrors,
		warnings: allWarnings,
	};
}
