# weapp-vite Debug Playbook

## Symptoms -> First checks

1. Page/route missing

- Check `srcRoot` and page directory structure.
- Check auto routes enablement and generated route typings.

2. Component not resolved

- Check `component: true` and path casing.
- Check auto import `globs` and resolver coverage.

3. Build output misplaced

- Check `project.config.json` roots and weapp output assumptions.
- Use debug hooks to verify watched files and resolved IDs.

4. Subpackage chunk surprises

- Confirm `sharedStrategy` and overrides.
- Inspect analyze output before adding more overrides.
