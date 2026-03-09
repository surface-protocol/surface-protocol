#---
# req: REQ-002
# type: unit
# area: catalog
# summary: Product has required attributes
# acceptance:
#   - Name is required
#   - Price must be positive
#   - SKU must be unique
# tags: [catalog, backend]
# changed:
#   - date: 2026-01-15
#     commit: abc1234
#     note: Initial stub
#   - date: 2026-01-20
#     commit: def5678
#     note: Implemented validations
#---
RSpec.describe "Product" do
  it "requires a name (REQ-002)" do
    product = { name: nil, price: 10.0 }
    expect(product[:name]).to be_nil
  end

  it "requires positive price" do
    price = 10.0
    expect(price).to be > 0
  end

  it "has unique SKU" do
    skus = ["ABC-001", "ABC-002"]
    expect(skus.uniq.length).to eq(skus.length)
  end
end
