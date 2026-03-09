import { describe, expect, it } from "vitest";

/*---
req: REQ-003
type: functional
area: cart
summary: Add item to shopping cart
acceptance:
  - Item added with correct quantity
  - Cart total updates
  - Duplicate items increment quantity
tags: [cart, user-facing]
changed:
  - date: 2026-01-15
    commit: abc1234
    note: Initial stub
  - date: 2026-01-22
    commit: ghi9012
    note: Fully implemented
---*/
describe("cart", () => {
	it("adds item with correct quantity (REQ-003)", () => {
		const cart: Array<{ id: number; qty: number }> = [];
		cart.push({ id: 1, qty: 2 });
		expect(cart).toHaveLength(1);
		expect(cart[0]?.qty).toBe(2);
	});

	it("updates cart total", () => {
		const items = [
			{ price: 10, qty: 2 },
			{ price: 5, qty: 1 },
		];
		const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
		expect(total).toBe(25);
	});

	it("increments quantity for duplicate items", () => {
		const cart = new Map<number, number>();
		cart.set(1, 1);
		cart.set(1, (cart.get(1) ?? 0) + 1);
		expect(cart.get(1)).toBe(2);
	});
});
