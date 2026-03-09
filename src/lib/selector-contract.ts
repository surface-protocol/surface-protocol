export interface SurfaceSelector {
	componentId: string;
	actionId?: string;
	instanceId?: string;
}

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateComponentId(componentId: string): boolean {
	return KEBAB_CASE.test(componentId);
}

export function validateActionId(actionId: string): boolean {
	const parts = actionId.split(".");
	if (parts.length !== 2) return false;
	const [component, verb] = parts;
	return Boolean(component && verb && validateComponentId(component) && KEBAB_CASE.test(verb));
}

export function buildSelectorAttributes(selector: SurfaceSelector): Record<string, string> {
	const attributes: Record<string, string> = {};
	if (!validateComponentId(selector.componentId)) {
		throw new Error(`Invalid component id: ${selector.componentId}`);
	}

	attributes["data-test-id"] = selector.actionId ?? selector.componentId;

	if (selector.actionId && !validateActionId(selector.actionId)) {
		throw new Error(`Invalid action id: ${selector.actionId}`);
	}

	if (selector.instanceId) {
		attributes["data-test-instance"] = selector.instanceId;
	}

	return attributes;
}

export function explainSelectorContract(): string[] {
	return [
		"`data-test-id` identifies stable components and controls.",
		"Component ids are nouns in kebab-case like `checkout-form`.",
		"Action ids are `<component>.<verb>` like `checkout-form.submit`.",
		"Repeated items use `data-test-instance` for identity, not dynamic selector soup.",
	];
}
