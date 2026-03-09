# Ruby + RSpec Adapter

Adapter id: `ruby-rspec`

## Metadata Carrier

Ruby metadata uses a leading comment YAML carrier:

```rb
# ---
# req: REQ-001
# type: unit
# summary: Checkout form submits
# ---
```

## RSpec

- Requirement stubs land in `spec/requirements/*_spec.rb`.
- Placeholder examples use `skip "TODO"`.

## Notes

- Rails support must not depend on a Claude plugin for Ruby.
- Browser-level verification can still use generic selector rules if the target
  repo also has a browser test layer.
- Minitest support is not yet implemented. Contributions welcome.
