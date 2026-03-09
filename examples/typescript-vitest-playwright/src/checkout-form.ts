export function renderCheckoutForm(lineItemId: string): string {
	return `
    <form data-test-id="checkout-form">
      <div data-test-id="cart-line-item" data-test-instance="${lineItemId}">
        <button type="submit" data-test-id="checkout-form.submit">Submit order</button>
      </div>
    </form>
  `;
}
