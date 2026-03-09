#---
# req: REQ-001
# type: unit
# status: pending
# area: auth
# summary: User model validates email format
# acceptance:
#   - Rejects blank email
#   - Rejects malformed email
#   - Accepts valid email
# tags: [auth, backend]
# changed:
#   - date: 2026-01-15
#     commit: abc1234
#     note: Initial stub created
#---
RSpec.describe "User validation" do
  it "validates email format (REQ-001)" do
    pending "Not yet implemented"
  end
end
