# HMR AST Engine Comparison

- generatedAt: 2026-06-15T14:30:46.577Z
- app: apps/hmr-lab
- iterations: 2
- stable scenarios: 20
- Babel startup: 1257.38 ms
- OXC startup: 1255.65 ms
- average HMR: Babel 48.49 ms / OXC 50.92 ms (+5.0%)

## Summary

This report compares the same `apps/hmr-lab` HMR scenarios with `weapp.ast.engine` set to `babel` and `oxc`. Only scenarios that completed successfully in both runs are included in the aggregate performance table.

| metric | Babel | OXC | delta |
| --- | ---: | ---: | ---: |
| startup | 1257.38 ms | 1255.65 ms | -1.74 ms |
| stable avg HMR | 48.49 ms | 50.92 ms | +2.44 ms (+5.0%) |

## Scenario Comparison

| scenario | source | Babel avg | OXC avg | delta | speedup | Babel transform | OXC transform |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sfc-template | src/pages/sfc/index.vue | 165.76 ms | 176.87 ms | +11.11 ms | -6.7% | 12.99 ms | 12.22 ms |
| sfc-style | src/pages/sfc/index.vue | 133.04 ms | 134.50 ms | +1.46 ms | -1.1% | 4.17 ms | 4.33 ms |
| shared-ts | src/shared/tokens.ts | 129.78 ms | 140.03 ms | +10.25 ms | -7.9% | 5.91 ms | 6.94 ms |
| sfc-script | src/pages/sfc/index.vue | 123.30 ms | 129.14 ms | +5.84 ms | -4.7% | 5.71 ms | 5.37 ms |
| native-script | src/pages/native/index.ts | 56.65 ms | 46.23 ms | -10.43 ms | +18.4% | 0.62 ms | 0.59 ms |
| subpackage-script | src/subpackages/lab/pages/sub-native/index.ts | 46.51 ms | 51.61 ms | +5.09 ms | -11.0% | 0.50 ms | 0.50 ms |
| component-script | src/components/probe-card/index.ts | 45.42 ms | 49.36 ms | +3.93 ms | -8.7% | 0.31 ms | 0.31 ms |
| app-wxss | src/app.wxss | 25.82 ms | 24.40 ms | -1.41 ms | +5.5% | 0.11 ms | 0.10 ms |
| native-template | src/pages/native/index.wxml | 24.15 ms | 26.71 ms | +2.56 ms | -10.6% | 0.11 ms | 0.11 ms |
| native-json | src/pages/native/index.json | 23.52 ms | 23.99 ms | +0.48 ms | -2.0% | 0.11 ms | 0.10 ms |
| app-json | src/app.json | 22.60 ms | 25.12 ms | +2.51 ms | -11.1% | 0.10 ms | 0.09 ms |
| subpackage-style | src/subpackages/lab/pages/sub-native/index.wxss | 21.34 ms | 18.03 ms | -3.31 ms | +15.5% | 0.09 ms | 0.10 ms |
| component-json | src/components/probe-card/index.json | 21.28 ms | 24.54 ms | +3.26 ms | -15.3% | 0.12 ms | 0.12 ms |
| shared-wxs | src/shared/wxs/format.wxs | 20.30 ms | 23.61 ms | +3.31 ms | -16.3% | 0.09 ms | 0.09 ms |
| component-template | src/components/probe-card/index.wxml | 19.90 ms | 21.47 ms | +1.56 ms | -7.9% | 0.11 ms | 0.13 ms |
| native-style | src/pages/native/index.wxss | 19.29 ms | 19.03 ms | -0.26 ms | +1.3% | 0.09 ms | 0.10 ms |
| subpackage-json | src/subpackages/lab/pages/sub-native/index.json | 18.65 ms | 14.25 ms | -4.40 ms | +23.6% | 0.08 ms | 0.07 ms |
| html-template | src/pages/html/index.html | 18.43 ms | 17.48 ms | -0.95 ms | +5.2% | 0.11 ms | 0.11 ms |
| component-style | src/components/probe-card/index.wxss | 18.16 ms | 35.97 ms | +17.81 ms | -98.0% | 0.10 ms | 0.25 ms |
| subpackage-template | src/subpackages/lab/pages/sub-native/index.wxml | 15.83 ms | 16.16 ms | +0.33 ms | -2.1% | 0.08 ms | 0.07 ms |

## Data Quality

Some HMR lab scenarios failed their marker wait in one or both runs. The profile stream still recorded updates for several of these, which indicates benchmark fixture drift rather than a usable engine comparison signal. They are excluded from the aggregate table above.

### Babel failures

- app-script: Timed out waiting for apps/hmr-lab/dist/app.js to contain marker: HMR_LAB_APP_SCRIPT_1
- shared-scss: Timed out waiting for dist to contain marker: hmr-lab-shared-scss-1
- shared-template-import: Timed out waiting for apps/hmr-lab/dist/shared/templates/card.wxml to contain marker: HMR_LAB_SHARED_TEMPLATE_IMPORT_1

### OXC failures

- app-script: Timed out waiting for apps/hmr-lab/dist/app.js to contain marker: HMR_LAB_APP_SCRIPT_1
- shared-scss: Timed out waiting for dist to contain marker: hmr-lab-shared-scss-1
- shared-template-include: Timed out waiting for apps/hmr-lab/dist/shared/templates/partial.wxml to contain marker: HMR_LAB_SHARED_TEMPLATE_INCLUDE_2

## Optimization Notes

- Component prop extraction rejects sources that only mention props/properties but never call a component/options factory.
- Feature flag extraction requires relevant module/hook text plus a call-expression shape before parsing, while aliased hook calls remain supported.
- OXC component prop traversal stops after the first resolved options object.
- OXC page-feature preflight now reuses the OXC AST to collect wevu options objects, removing the previous Babel fallback parse on factory-call hits.
- HMR lab can switch AST engine with HMR_LAB_AST_ENGINE=babel|oxc and records the engine in reports.
