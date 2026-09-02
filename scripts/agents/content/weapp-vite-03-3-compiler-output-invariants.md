## 3. Compiler Output Invariants

- Template call expressions must compile to runtime bindings (for example `__wv_bind_*`) instead of leaving raw calls in WXML.
- Script setup expression access should preserve `__wevuProps` first and instance fallback semantics.
- Keep runtime safety guards (`try/catch`) around generated class/style and call-expression bindings where expected.
- Do not weaken existing issue regression coverage when adjusting generated code strings.
