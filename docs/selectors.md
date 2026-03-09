# UI Selector Contract

Surface Protocol uses stable, durable selectors for UI testing — not CSS classes, not auto-generated IDs, not XPath.

## Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-test-id` | Identifies a component or action | `checkout-form`, `checkout-form.submit` |
| `data-test-instance` | Distinguishes repeated items | `line-item-42` |

## Component IDs

Component IDs are **nouns in kebab-case**:

```
checkout-form       ✓
product-card        ✓
CheckoutForm        ✗  (PascalCase)
checkout_form       ✗  (snake_case)
```

## Action IDs

Action IDs follow the pattern `<component>.<verb>`:

```
checkout-form.submit     ✓
product-card.add-to-cart ✓
submit                   ✗  (no component prefix)
```

## Instance IDs

For repeated items (e.g., list rows), use `data-test-instance` to distinguish:

```html
<div data-test-id="line-item" data-test-instance="sku-abc123">...</div>
<div data-test-id="line-item" data-test-instance="sku-def456">...</div>
```

## Why Not CSS Classes?

- CSS classes change when you refactor styles
- Auto-generated IDs change between renders
- XPath breaks when DOM structure changes
- `data-test-*` attributes are stable, explicit, and survive refactoring

## Validation

The `selector-contract` module validates selectors programmatically:

```typescript
import { validateComponentId, validateActionId } from "@surface-protocol/cli";

validateComponentId("checkout-form");        // true
validateComponentId("CheckoutForm");         // false
validateActionId("checkout-form.submit");    // true
validateActionId("submit");                  // false
```
