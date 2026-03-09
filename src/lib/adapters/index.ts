/**
 * Adapter Registry
 *
 * Import this module to register all built-in adapters.
 */

export {
	type CommentFormat,
	getAdapter,
	getAdapterNames,
	registerAdapter,
	type StackAdapter,
} from "./adapter.js";
export { rubyRspecAdapter } from "./ruby-rspec.js";
export { typescriptVitestAdapter } from "./typescript-vitest.js";
