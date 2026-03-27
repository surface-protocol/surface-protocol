#!/usr/bin/env node

/**
 * Surface Protocol CLI
 *
 * Tests are the spec. surface.json is the queryable truth.
 */

import { Command } from "commander";
import { registerBackfillCommand } from "./surface-backfill.js";
import { registerCheckCommand } from "./surface-check.js";
import { registerDiscoverCommand } from "./surface-discover.js";
import { registerGenCommand } from "./surface-gen.js";
import { registerInitCommand } from "./surface-init.js";
import { registerMetricsCommand } from "./surface-metrics.js";
import { registerQueryCommand } from "./surface-query.js";
import { registerScanCommand } from "./surface-scan.js";

const program = new Command()
	.name("surface")
	.description("Surface Protocol — test-driven requirement tracking")
	.version("0.1.0");

registerInitCommand(program);
registerGenCommand(program);
registerCheckCommand(program);
registerScanCommand(program);
registerBackfillCommand(program);
registerDiscoverCommand(program);
registerQueryCommand(program);
registerMetricsCommand(program);

program.parse();
