# HMR AST Engine Comparison

- generatedAt: 2026-06-15T14:04:24.805Z
- app: apps/hmr-lab
- iterations: 2
- stable scenarios: 20
- Babel startup: 1507.26 ms
- OXC startup: 1507.52 ms
- average HMR: Babel 47.14 ms / OXC 48.31 ms (+2.0%)

## Summary

This report compares the same `apps/hmr-lab` HMR scenarios with `weapp.ast.engine` set to `babel` and `oxc`. Only scenarios that completed successfully in both runs are included in the aggregate performance table.

| metric | Babel | OXC | delta |
| --- | ---: | ---: | ---: |
| startup | 1507.26 ms | 1507.52 ms | 0.26 ms |
| stable avg HMR | 47.14 ms | 48.31 ms | 1.17 ms (+2.0%) |

## Scenario Comparison

| scenario | source | Babel avg | OXC avg | delta | speedup | Babel transform | OXC transform |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sfc-template | src/pages/sfc/index.vue | 168.25 ms | 172.22 ms | 3.97 ms | -2.4% | 12.83 ms | 12.71 ms |
| shared-ts | src/shared/tokens.ts | 131.33 ms | 136.49 ms | 5.16 ms | -3.9% | 6.48 ms | 6.48 ms |
| sfc-script | src/pages/sfc/index.vue | 125.14 ms | 127.66 ms | 2.52 ms | -2.0% | 6.11 ms | 5.68 ms |
| sfc-style | src/pages/sfc/index.vue | 117.65 ms | 143.20 ms | 25.55 ms | -21.7% | 3.52 ms | 4.02 ms |
| native-script | src/pages/native/index.ts | 47.64 ms | 47.93 ms | 0.29 ms | -0.6% | 0.58 ms | 0.61 ms |
| component-script | src/components/probe-card/index.ts | 46.15 ms | 40.95 ms | -5.20 ms | +11.3% | 0.30 ms | 0.26 ms |
| subpackage-script | src/subpackages/lab/pages/sub-native/index.ts | 41.29 ms | 54.01 ms | 12.72 ms | -30.8% | 0.35 ms | 0.31 ms |
| component-style | src/components/probe-card/index.wxss | 33.90 ms | 22.12 ms | -11.78 ms | +34.8% | 0.19 ms | 0.10 ms |
| native-template | src/pages/native/index.wxml | 23.84 ms | 22.75 ms | -1.09 ms | +4.6% | 0.13 ms | 0.12 ms |
| native-style | src/pages/native/index.wxss | 23.51 ms | 23.37 ms | -0.14 ms | +0.6% | 0.12 ms | 0.10 ms |
| app-json | src/app.json | 22.73 ms | 20.90 ms | -1.83 ms | +8.0% | 0.10 ms | 0.13 ms |
| shared-wxs | src/shared/wxs/format.wxs | 22.25 ms | 19.39 ms | -2.86 ms | +12.9% | 0.12 ms | 0.06 ms |
| native-json | src/pages/native/index.json | 21.88 ms | 23.67 ms | 1.79 ms | -8.2% | 0.09 ms | 0.13 ms |
| component-json | src/components/probe-card/index.json | 20.97 ms | 19.22 ms | -1.75 ms | +8.3% | 0.13 ms | 0.10 ms |
| component-template | src/components/probe-card/index.wxml | 19.53 ms | 19.18 ms | -0.35 ms | +1.8% | 0.11 ms | 0.14 ms |
| app-wxss | src/app.wxss | 18.21 ms | 16.37 ms | -1.84 ms | +10.1% | 0.08 ms | 0.08 ms |
| html-template | src/pages/html/index.html | 17.37 ms | 20.41 ms | 3.05 ms | -17.6% | 0.18 ms | 0.10 ms |
| subpackage-template | src/subpackages/lab/pages/sub-native/index.wxml | 14.20 ms | 11.55 ms | -2.65 ms | +18.7% | 0.08 ms | 0.07 ms |
| subpackage-style | src/subpackages/lab/pages/sub-native/index.wxss | 13.80 ms | 12.62 ms | -1.19 ms | +8.6% | 0.08 ms | 0.06 ms |
| subpackage-json | src/subpackages/lab/pages/sub-native/index.json | 13.11 ms | 12.17 ms | -0.94 ms | +7.2% | 0.08 ms | 0.05 ms |

## Data Quality

Some HMR lab scenarios failed their marker wait in one or both runs. The profile stream still recorded updates for several of these, which indicates benchmark fixture drift rather than a usable engine comparison signal. They are excluded from the aggregate table above.

### Babel failures

- app-script: Timed out waiting for apps/hmr-lab/dist/app.js to contain marker: HMR_LAB_APP_SCRIPT_1
- shared-scss: Timed out waiting for dist to contain marker: hmr-lab-shared-scss-1
- shared-template-import: Timed out waiting for apps/hmr-lab/dist/shared/templates/card.wxml to contain marker: HMR_LAB_SHARED_TEMPLATE_IMPORT_1

### OXC failures

- app-script: Timed out waiting for apps/hmr-lab/dist/app.js to contain marker: HMR_LAB_APP_SCRIPT_1
- shared-scss: Timed out waiting for dist to contain marker: hmr-lab-shared-scss-1
- shared-template-include: Timed out waiting for apps/hmr-lab/dist/shared/templates/partial.wxml to contain marker: HMR_LAB_SHARED_TEMPLATE_INCLUDE_1

## Optimization Notes

- Component prop extraction now rejects sources that only mention `props` or `properties` but never call a component/options factory, avoiding unnecessary Babel/OXC parsing during auto-import metadata refresh.
- Feature flag extraction now requires both a relevant module/hook hint and at least one call-expression shape before parsing, so imports/re-exports or plain references do not trigger full AST analysis while aliased hook calls still work.
- OXC component prop traversal stops after the first resolved options object, avoiding a full tree walk once the metadata target is found.
- The HMR lab config can now be switched with `HMR_LAB_AST_ENGINE=babel|oxc`, and benchmark reports record the selected engine.
