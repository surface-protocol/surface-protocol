import { describe, expect, it } from "vitest";
import {
	buildSelectorAttributes,
	explainSelectorContract,
	validateActionId,
	validateComponentId,
} from "../../src/lib/selector-contract.ts";

describe("selector contract", () => {
	it("validates component ids and action ids", () => {
		expect(validateComponentId("checkout-form")).toBe(true);
		expect(validateComponentId("CheckoutForm")).toBe(false);
		expect(validateActionId("checkout-form.submit")).toBe(true);
		expect(validateActionId("submit")).toBe(false);
	});

	it("builds selector attributes with optional instance ids", () => {
		expect(
			buildSelectorAttributes({
				componentId: "checkout-form",
				actionId: "checkout-form.submit",
				instanceId: "line-item-42",
			}),
		).toEqual({
			"data-test-id": "checkout-form.submit",
			"data-test-instance": "line-item-42",
		});
	});

	it("documents the selector rules", () => {
		expect(explainSelectorContract().join(" ")).toContain("data-test-id");
	});
});
