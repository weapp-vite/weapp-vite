# Template Compatibility Matrix

## `v-model`

- Recommended: assignable left values (`x`, `x.y`, `x[i]`).
- Avoid: expression targets (`a + b`, function calls, optional chaining targets).
- Avoid assuming full web Vue `v-model` modifier/argument parity.

## `v-bind`

- Do not use `v-bind="object"` expansion in current mini-program template pipeline.
- Use explicit `:prop="..."` and `@event="..."` bindings.

## Component events

- Prefer mini-program event naming/semantics in templates.
- For custom components, keep `valueProp` + `event` contract explicit.
