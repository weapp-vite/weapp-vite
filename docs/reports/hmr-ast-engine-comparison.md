# HMR AST Engine Comparison

- generatedAt: 2026-06-15T14:43:59.851Z
- app: apps/hmr-lab
- iterations: 2
- stable scenarios: 20
- Babel startup: 1507.77 ms
- OXC startup: 1505.89 ms
- average HMR: Babel 59.06 ms / OXC 50.98 ms (-13.7%)

## Summary

This report compares the same `apps/hmr-lab` HMR scenarios with `weapp.ast.engine` set to `babel` and `oxc`. Only scenarios that completed successfully in both runs are included in the aggregate performance table.

| metric | Babel | OXC | delta |
| --- | ---: | ---: | ---: |
| startup | 1507.77 ms | 1505.89 ms | -1.88 ms |
| stable avg HMR | 59.06 ms | 50.98 ms | -8.09 ms (-13.7%) |

## Scenario Comparison

| scenario | source | Babel avg | OXC avg | delta | speedup | Babel transform | OXC transform |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sfc-style | src/pages/sfc/index.vue | 313.08 ms | 141.82 ms | -171.26 ms | +54.7% | 4.10 ms | 3.34 ms |
| sfc-template | src/pages/sfc/index.vue | 163.05 ms | 178.06 ms | +15.00 ms | -9.2% | 11.46 ms | 12.71 ms |
| shared-ts | src/shared/tokens.ts | 130.74 ms | 136.97 ms | +6.24 ms | -4.8% | 5.44 ms | 6.41 ms |
| sfc-script | src/pages/sfc/index.vue | 121.59 ms | 135.65 ms | +14.06 ms | -11.6% | 5.31 ms | 5.76 ms |
| native-script | src/pages/native/index.ts | 56.26 ms | 49.54 ms | -6.72 ms | +11.9% | 0.57 ms | 0.60 ms |
| component-script | src/components/probe-card/index.ts | 52.70 ms | 45.98 ms | -6.72 ms | +12.8% | 0.32 ms | 0.35 ms |
| subpackage-script | src/subpackages/lab/pages/sub-native/index.ts | 50.68 ms | 56.83 ms | +6.15 ms | -12.1% | 0.55 ms | 0.59 ms |
| component-style | src/components/probe-card/index.wxss | 37.97 ms | 19.65 ms | -18.32 ms | +48.2% | 0.32 ms | 0.10 ms |
| app-json | src/app.json | 29.02 ms | 21.04 ms | -7.97 ms | +27.5% | 0.11 ms | 0.09 ms |
| shared-wxs | src/shared/wxs/format.wxs | 26.41 ms | 24.58 ms | -1.82 ms | +6.9% | 0.11 ms | 0.09 ms |
| subpackage-json | src/subpackages/lab/pages/sub-native/index.json | 23.25 ms | 20.75 ms | -2.51 ms | +10.8% | 0.11 ms | 0.09 ms |
| native-json | src/pages/native/index.json | 22.92 ms | 23.83 ms | +0.90 ms | -3.9% | 0.12 ms | 0.11 ms |
| component-json | src/components/probe-card/index.json | 22.27 ms | 21.45 ms | -0.82 ms | +3.7% | 0.11 ms | 0.13 ms |
| subpackage-style | src/subpackages/lab/pages/sub-native/index.wxss | 22.24 ms | 24.28 ms | +2.04 ms | -9.2% | 0.10 ms | 0.12 ms |
| subpackage-template | src/subpackages/lab/pages/sub-native/index.wxml | 20.50 ms | 18.34 ms | -2.15 ms | +10.5% | 0.13 ms | 0.07 ms |
| app-wxss | src/app.wxss | 20.26 ms | 17.85 ms | -2.41 ms | +11.9% | 0.13 ms | 0.08 ms |
| component-template | src/components/probe-card/index.wxml | 19.08 ms | 19.82 ms | +0.74 ms | -3.9% | 0.10 ms | 0.10 ms |
| native-template | src/pages/native/index.wxml | 18.75 ms | 22.85 ms | +4.09 ms | -21.8% | 0.09 ms | 0.12 ms |
| native-style | src/pages/native/index.wxss | 16.76 ms | 22.94 ms | +6.18 ms | -36.9% | 0.08 ms | 0.11 ms |
| html-template | src/pages/html/index.html | 13.71 ms | 17.29 ms | +3.58 ms | -26.1% | 0.12 ms | 0.10 ms |

## Data Quality

Some HMR lab scenarios failed their marker wait in one or both runs. The profile stream still recorded updates for several of these, which indicates benchmark fixture drift rather than a usable engine comparison signal. They are excluded from the aggregate table above.

### Babel failures

- app-script: Timed out waiting for apps/hmr-lab/dist/app.js to contain marker: HMR_LAB_APP_SCRIPT_1
- shared-scss: Timed out waiting for dist to contain marker: hmr-lab-shared-scss-1
- shared-template-import: Timed out waiting for apps/hmr-lab/dist/shared/templates/card.wxml to contain marker: HMR_LAB_SHARED_TEMPLATE_IMPORT_2

### OXC failures

- app-script: Timed out waiting for apps/hmr-lab/dist/app.js to contain marker: HMR_LAB_APP_SCRIPT_1
- shared-scss: Timed out waiting for dist to contain marker: hmr-lab-shared-scss-1
- shared-template-include: Timed out waiting for apps/hmr-lab/dist/shared/templates/partial.wxml to contain marker: HMR_LAB_SHARED_TEMPLATE_INCLUDE_1

## Optimization Notes

- Component prop extraction rejects sources that only mention props/properties but never call a component/options factory.
- Feature flag extraction requires relevant module/hook text plus a call-expression shape before parsing, while aliased hook calls remain supported.
- wevu page-feature collection now shares the same text preflight before Babel parsing, so unrelated files skip AST creation in both engines.
- OXC page-feature collection reuses one module analysis pass for both wevu and wevu/internal-runtime imports, avoiding duplicate parser work on internal runtime modules.
- OXC component prop traversal stops after the first resolved options object.
- OXC page-feature preflight reuses the OXC AST to collect wevu options objects, removing the previous Babel fallback parse on factory-call hits.
- HMR lab can switch AST engine with HMR_LAB_AST_ENGINE=babel|oxc and records the engine in reports.
