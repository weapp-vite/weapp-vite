# Templates HMR Benchmark

- generatedAt: 2026-05-19T17:03:52.347Z
- templates: 9
- scenarios: 65/69
- iterations: 1
- budget: 500 ms
- timeout: 30000 ms
- max profile total: 13360.24 ms
- max observed wall: 18940.56 ms
- over-budget scenarios: 34/69
- failed templates: 0
- failed scenarios: 4

| template | startup | scenarios | max profile | max wall | failures |
| --- | ---: | ---: | ---: | ---: | --- |
| weapp-vite-lib-template | 1222.59 | 11 | 509.32 | 509.32 | - |
| weapp-vite-plugin-template | 713.93 | 6 | 100.91 | 306.85 | native-page-template: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-plugin-template/dist/pages/index/index.wxml to contain marker: HMR_BENCH_WEAPP_VITE_PLUGIN_TEMPLATE_NATIVE_PAGE_TEMPLATE_1_mpcvh1wu |
| weapp-vite-tailwindcss-tdesign-template | 9069.64 | 8 | 7200.34 | 8072.79 | - |
| weapp-vite-tailwindcss-template | 8961.47 | 8 | 8787.54 | 8787.54 | app-json: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-tailwindcss-template/dist/app.json to contain marker: HMR_BENCH_WEAPP_VITE_TAILWINDCSS_TEMPLATE_APP_JSON_1_mpcvjbuf |
| weapp-vite-tailwindcss-vant-template | 8447.14 | 8 | 8588.53 | 8588.53 | app-json: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-tailwindcss-vant-template/dist/app.json to contain marker: HMR_BENCH_WEAPP_VITE_TAILWINDCSS_VANT_TEMPLATE_APP_JSON_1_mpcvl6t2 |
| weapp-vite-template | 1117.17 | 8 | 306.35 | 306.35 | - |
| weapp-vite-wevu-tailwindcss-tdesign-retail-template | 11397.72 | 6 | 10264.64 | 18940.56 | vue-app-json-macro: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-wevu-tailwindcss-tdesign-retail-template/dist/app.json to contain marker: HMR_BENCH_WEAPP_VITE_WEVU_TAILWINDCSS_TDESIGN_RETAIL_TEMPLATE_VUE_APP_JSON_MACRO_1_mpcvnlnf |
| weapp-vite-wevu-tailwindcss-tdesign-template | 9661.07 | 7 | 13360.24 | 13360.24 | - |
| weapp-vite-wevu-template | 1120.74 | 7 | 306.47 | 307.44 | - |

## weapp-vite-lib-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| vue | components/sfc-script/index.vue template | 198.33 ms | 198.33 ms | 309.75 ms | 309.75 ms | 6 | 6 | entry-direct:1 x1 | shared-chunk(wevu-src.js,weapp-vite-runtime.js+)+5:direct x1 | ok |
| vue | components/sfc-script/index.vue script | 141.84 ms | 141.84 ms | 304.58 ms | 304.58 ms | 6 | 6 | entry-direct:1 x1 | shared-chunk(wevu-src.js,weapp-vite-runtime.js+)+5:direct x1 | ok |
| vue | components/sfc-script/index.vue style | 177.40 ms | 177.40 ms | 304.94 ms | 304.94 ms | 6 | 6 | entry-direct:1 x1 | shared-chunk(wevu-src.js,weapp-vite-runtime.js+)+5:direct x1 | ok |
| app | app.json | 308.47 ms | 308.47 ms | 308.47 ms | 308.47 ms | - | - | - | - | ok |
| app | app.ts | 49.72 ms | 49.72 ms | 203.17 ms | 203.17 ms | 0 | 0 | - | - | ok |
| app | app.scss | 35.83 ms | 35.83 ms | 203.33 ms | 203.33 ms | 0 | 0 | importer-graph:1 x1 | - | ok |
| native-page | pages/index/index.wxml | 509.32 ms | 509.32 ms | 509.32 ms | 509.32 ms | - | - | - | - | over budget |
| native-page | pages/index/index.ts | 164.01 ms | 164.01 ms | 307.35 ms | 307.35 ms | 6 | 6 | entry-direct:1 x1 | shared-chunk(wevu-src.js,weapp-vite-runtime.js+)+5:direct x1 | ok |
| native-page | pages/index/index.scss | 137.70 ms | 137.70 ms | 306.86 ms | 306.86 ms | 6 | 6 | entry-direct:1 x1 | shared-chunk(wevu-src.js,weapp-vite-runtime.js+)+5:direct x1 | ok |
| json | sitemap.json | 204.89 ms | 204.89 ms | 204.89 ms | 204.89 ms | - | - | - | - | ok |
| json | theme.json | 204.36 ms | 204.36 ms | 204.36 ms | 204.36 ms | - | - | - | - | ok |

## weapp-vite-plugin-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| app | app.json | 75.57 ms | 75.57 ms | 306.85 ms | 306.85 ms | - | - | - | - | ok |
| app | app.ts | 10.61 ms | 10.61 ms | 102.08 ms | 102.08 ms | - | - | - | - | ok |
| native-page | pages/index/index.wxml | - | - | - | - | - | - | - | - | failed: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-plugin-template/dist/pages/index/index.wxml to contain marker: HMR_BENCH_WEAPP_VITE_PLUGIN_TEMPLATE_NATIVE_PAGE_TEMPLATE_1_mpcvh1wu |
| native-page | pages/index/index.ts | 19.07 ms | 19.07 ms | 102.14 ms | 102.14 ms | 1 | 1 | sidecar-direct:1 x1<br>entry-direct:1 x1 | - | ok |
| native-page | pages/index/index.wxss | 15.12 ms | 15.12 ms | 101.34 ms | 101.34 ms | 1 | 1 | entry-direct:1 x1 | - | ok |
| json | sitemap.json | 100.91 ms | 100.91 ms | 100.91 ms | 100.91 ms | - | - | - | - | ok |

## weapp-vite-tailwindcss-tdesign-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| app | app.json | 865.32 ms | 865.32 ms | 933.80 ms | 933.80 ms | - | - | - | - | over budget |
| app | app.ts | 485.88 ms | 485.88 ms | 815.60 ms | 815.60 ms | 0 | 0 | importer-graph:1 x1 | - | ok |
| app | app.css | 7200.34 ms | 7200.34 ms | 7266.53 ms | 7266.53 ms | 0 | 0 | importer-graph:1 x1 | - | over budget |
| native-page | pages/index/index.wxml | 873.22 ms | 873.22 ms | 8072.79 ms | 8072.79 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | over budget |
| native-page | pages/index/index.ts | 554.54 ms | 554.54 ms | 619.57 ms | 619.57 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | over budget |
| native-page | pages/index/index.scss | 538.12 ms | 538.12 ms | 617.38 ms | 617.38 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | over budget |
| json | sitemap.json | 916.93 ms | 916.93 ms | 916.93 ms | 916.93 ms | - | - | - | - | over budget |
| json | theme.json | 513.80 ms | 513.80 ms | 513.80 ms | 513.80 ms | - | - | - | - | over budget |

## weapp-vite-tailwindcss-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| app | app.json | - | - | - | - | - | - | - | - | failed: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-tailwindcss-template/dist/app.json to contain marker: HMR_BENCH_WEAPP_VITE_TAILWINDCSS_TEMPLATE_APP_JSON_1_mpcvjbuf |
| app | app.ts | 900.08 ms | 900.08 ms | 926.49 ms | 926.49 ms | 0 | 0 | sidecar-direct:1 x1 | - | over budget |
| app | app.css | 7460.36 ms | 7460.36 ms | 7461.70 ms | 7461.70 ms | 0 | 0 | importer-graph:1 x1 | - | over budget |
| native-page | pages/index/index.wxml | 8787.54 ms | 8787.54 ms | 8787.54 ms | 8787.54 ms | - | - | - | - | over budget |
| native-page | pages/index/index.ts | 506.02 ms | 506.02 ms | 517.23 ms | 517.23 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | over budget |
| native-page | pages/index/index.scss | 516.47 ms | 516.47 ms | 515.13 ms | 515.13 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | over budget |
| json | sitemap.json | 816.88 ms | 816.88 ms | 816.88 ms | 816.88 ms | - | - | - | - | over budget |
| json | theme.json | 510.25 ms | 510.25 ms | 510.25 ms | 510.25 ms | - | - | - | - | over budget |

## weapp-vite-tailwindcss-vant-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| app | app.json | - | - | - | - | - | - | - | - | failed: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-tailwindcss-vant-template/dist/app.json to contain marker: HMR_BENCH_WEAPP_VITE_TAILWINDCSS_VANT_TEMPLATE_APP_JSON_1_mpcvl6t2 |
| app | app.ts | 677.85 ms | 677.85 ms | 718.08 ms | 718.08 ms | 0 | 0 | sidecar-direct:1 x1 | - | over budget |
| app | app.css | 6979.51 ms | 6979.51 ms | 7045.29 ms | 7045.29 ms | 0 | 0 | importer-graph:1 x1 | - | over budget |
| native-page | pages/index/index.wxml | 8588.53 ms | 8588.53 ms | 8588.53 ms | 8588.53 ms | - | - | - | - | over budget |
| native-page | pages/index/index.ts | 522.74 ms | 522.74 ms | 609.80 ms | 609.80 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | over budget |
| native-page | pages/index/index.scss | 523.04 ms | 523.04 ms | 519.45 ms | 519.45 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | over budget |
| json | sitemap.json | 813.81 ms | 813.81 ms | 813.81 ms | 813.81 ms | - | - | - | - | over budget |
| json | theme.json | 516.52 ms | 516.52 ms | 516.52 ms | 516.52 ms | - | - | - | - | over budget |

## weapp-vite-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| app | app.json | 37.82 ms | 37.82 ms | 204.02 ms | 204.02 ms | - | - | - | - | ok |
| app | app.ts | 35.53 ms | 35.53 ms | 203.79 ms | 203.79 ms | 0 | 0 | - | - | ok |
| app | app.scss | 39.14 ms | 39.14 ms | 206.25 ms | 206.25 ms | 0 | 0 | importer-graph:1 x1 | - | ok |
| native-page | pages/index/index.wxml | 306.35 ms | 306.35 ms | 306.35 ms | 306.35 ms | - | - | - | - | ok |
| native-page | pages/index/index.ts | 70.28 ms | 70.28 ms | 204.61 ms | 204.61 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | ok |
| native-page | pages/index/index.scss | 71.04 ms | 71.04 ms | 202.07 ms | 202.07 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(common.js)+2:direct x1 | ok |
| json | sitemap.json | 203.08 ms | 203.08 ms | 203.08 ms | 203.08 ms | - | - | - | - | ok |
| json | theme.json | 204.43 ms | 204.43 ms | 204.43 ms | 204.43 ms | - | - | - | - | ok |

## weapp-vite-wevu-tailwindcss-tdesign-retail-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| vue | app defineAppJson | - | - | - | - | - | - | - | - | failed: Timed out waiting for .tmp/templates-hmr-workspaces/weapp-vite-wevu-tailwindcss-tdesign-retail-template/dist/app.json to contain marker: HMR_BENCH_WEAPP_VITE_WEVU_TAILWINDCSS_TDESIGN_RETAIL_TEMPLATE_VUE_APP_JSON_MACRO_1_mpcvnlnf |
| vue | pages/home/home.vue definePageJson | 10045.56 ms | 10045.56 ms | 10090.74 ms | 10090.74 ms | 74 | 74 | entry-direct:1 x1 | - | over budget |
| vue | pages/home/home.vue template | 6383.19 ms | 6383.19 ms | 6417.01 ms | 6417.01 ms | 1 | 1 | entry-local-asset:1 x1 | - | over budget |
| vue | pages/home/home.vue script | 10264.64 ms | 10264.64 ms | 10287.47 ms | 10287.47 ms | 74 | 74 | entry-direct:1 x1 | shared-chunk(wevu-router.js,wevu-src.js+)+74:direct x1 | over budget |
| app | app.css | 7823.53 ms | 7823.53 ms | 7855.34 ms | 7855.34 ms | 1 | 1 | - | - | over budget |
| json | sitemap.json | 8134.82 ms | 8134.82 ms | 18940.56 ms | 18940.56 ms | - | - | - | - | over budget |

## weapp-vite-wevu-tailwindcss-tdesign-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| vue | app defineAppJson | 6780.21 ms | 6780.21 ms | 6836.37 ms | 6836.37 ms | 1 | 1 | importer-graph:1 x1 | shared-chunk(wevu-src.js,wevu-router.js+)+1:dependency x1 | over budget |
| vue | pages/index/index.vue definePageJson | 6735.98 ms | 6735.98 ms | 6735.98 ms | 6735.98 ms | - | - | - | - | over budget |
| vue | pages/index/index.vue template | 7311.97 ms | 7311.97 ms | 7336.78 ms | 7336.78 ms | 1 | 1 | entry-local-asset:1 x1 | - | over budget |
| vue | pages/index/index.vue script | 6598.85 ms | 6598.85 ms | 6620.86 ms | 6620.86 ms | 1 | 1 | entry-direct:1 x1 | shared-chunk(wevu-ref.js,wevu-src.js+)+1:direct x1 | over budget |
| app | app.css | 6946.01 ms | 6946.01 ms | 6946.01 ms | 6946.01 ms | - | - | - | - | over budget |
| json | sitemap.json | 13360.24 ms | 13360.24 ms | 13360.24 ms | 13360.24 ms | - | - | - | - | over budget |
| json | theme.json | 6720.09 ms | 6720.09 ms | 6720.09 ms | 6720.09 ms | - | - | - | - | over budget |

## weapp-vite-wevu-template

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| vue | app defineAppJson | 162.06 ms | 162.06 ms | 307.44 ms | 307.44 ms | 3 | 3 | importer-graph:1 x1 | shared-chunk(wevu-src.js,wevu-router.js+)+3:dependency x1 | ok |
| vue | pages/index/index.vue definePageJson | 306.01 ms | 306.01 ms | 306.01 ms | 306.01 ms | - | - | - | - | ok |
| vue | pages/index/index.vue template | 125.22 ms | 125.22 ms | 306.26 ms | 306.26 ms | 1 | 1 | entry-local-asset:1 x1 | - | ok |
| vue | pages/index/index.vue script | 123.40 ms | 123.40 ms | 203.42 ms | 203.42 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(wevu-ref.js,wevu-src.js+)+3:direct x1 | ok |
| vue | pages/index/index.vue style | 120.06 ms | 120.06 ms | 202.05 ms | 202.05 ms | 1 | 1 | entry-local-asset:1 x1 | - | ok |
| json | sitemap.json | 203.97 ms | 203.97 ms | 203.97 ms | 203.97 ms | - | - | - | - | ok |
| json | theme.json | 306.47 ms | 306.47 ms | 306.47 ms | 306.47 ms | - | - | - | - | ok |
