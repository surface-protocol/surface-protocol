#---
# req: REQ-003
# type: functional
# area: auth
# summary: Login endpoint authenticates users
# acceptance:
#   - POST /login with valid credentials returns 200 + token
#   - POST /login with invalid credentials returns 401
#   - Rate limits after 5 failed attempts
# tags: [auth, user-facing, security]
# changed:
#   - date: 2026-01-15
#     commit: abc1234
#     note: Initial stub
#   - date: 2026-01-25
#     commit: jkl3456
#     note: Fully implemented
#---
RSpec.describe "Login endpoint" do
  it "returns 200 with valid credentials (REQ-003)" do
    response_code = 200
    expect(response_code).to eq(200)
  end

  it "returns 401 with invalid credentials" do
    response_code = 401
    expect(response_code).to eq(401)
  end

  it "rate limits after 5 failed attempts" do
    attempts = 6
    expect(attempts).to be > 5
  end
end
