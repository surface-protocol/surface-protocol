/**
 * Discovery Adapter Registry
 *
 * Imports all built-in discovery adapters to register them.
 * Import this module before calling autoDetectAdapters().
 */

// Register all built-in adapters (side-effect imports)
import "./package-scripts.js";
import "./hono-routes.js";
import "./astro-pages.js";
import "./commander-cli.js";
import "./rails-routes.js";
import "./graphql-schema.js";

export { autoDetectAdapters, getAllDiscoveryAdapters, registerDiscoveryAdapter } from "./adapter.js";
export type { DiscoveryAdapter } from "./adapter.js";
export { linkCoverage } from "./coverage-linker.js";
