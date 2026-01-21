# WXML Recursive Dependency Collection

## Summary

Collect `import`/`include` dependencies recursively during WXML compilation, deduplicate them, and emit warnings on missing or circular references.

## Goals

- Expand dependencies across nested `import`/`include` chains.
- De-duplicate dependency entries.
- Warn on missing files and circular references without failing compilation.

## Non-Goals

- No runtime behavior changes.
- No attribute-based aliasing changes.

## Approach

- Add a shared dependency context (visited, active, warnings, dependency list).
- When compiling a root file, expand dependencies recursively by reading referenced templates and invoking `compileWxml` on them.
- Use an active stack to detect cycles and warn once per cycle edge.
- Keep rendering output scoped to the root file; nested compilation is used only for dependency collection.

## Error Handling

- If a template cannot be resolved or read, emit a warning and continue.
- If a cycle is detected, emit a warning and continue.

## Testing

- Recursive chain test: A includes B, B includes C; dependencies contain all three with no duplicates.
- Missing file test: include a non-existent file; warnings contain a missing-file message.
- Circular test: A includes B and B includes A; warnings contain a cycle message.

## Limitations

- Recursive parsing adds compilation overhead for deep dependency trees.
