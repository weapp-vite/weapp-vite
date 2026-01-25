# Path Compatibility Design

## Goals

- Normalize path comparisons and generated path strings across Windows, Linux, and macOS.
- Keep filesystem operations OS-native while making in-memory comparisons deterministic.
- Reduce test flakiness caused by path separators and relative path formatting.

## Scope

- Runtime path normalization helpers in `packages/weapp-vite/src/utils/path.ts`.
- Runtime usage updates in config resolution, npm copy filtering, and invalidation logic.
- Tests updated to cover new path helpers and avoid platform-specific failures.

## Proposed Changes

### Utilities

Add cross-platform helpers in `src/utils/path.ts`:

- `normalizePath(value)`: OS-independent (posix) normalized path for comparisons.
- `normalizeRelativePath(value)`: preserves empty relative paths but normalizes separators.
- Internal stripping of Windows device path prefixes (e.g., `\\?\`) before comparison.

### Runtime Integration

Adopt helpers where path strings are compared or stored as keys:

- Config service: normalize `relativeCwd`, `relativeAbsoluteSrcRoot`, and `relativeOutputPath` so output keys and map lookups are consistent across OSes.
- NPM copy filtering: normalize `path.relative` results before matching dependency regexes.
- Invalidate-entry utilities: use `normalizePath` for dependency graph keys.

### Tests

- Add unit coverage for new helpers in `src/utils/path.test.ts`.
- Avoid OS-specific relative path formatting in tests by using normalized outputs where relevant.

## Data Flow

1. Input path from filesystem → `normalizePath` for comparisons and map keys.
2. Output file names and manifest keys → normalized to posix for stability.
3. Actual file IO → continue using OS-native paths (`path.resolve`, `fs` APIs).

## Error Handling

- Preserve existing runtime errors and messaging.
- Helpers are non-throwing; they only normalize input strings.

## Testing Plan

- Unit test the path helpers.
- Run existing runtime tests that cover config and copy behavior.

## Risks

- Changing output key normalization could surface hidden assumptions in downstream consumers.
- Normalize behavior should avoid converting empty relative paths to `.` to preserve existing behavior.
