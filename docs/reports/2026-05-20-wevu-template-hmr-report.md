# wevu template HMR benchmark

- generatedAt: 2026-05-19T16:13:01.565Z
- source: templates/weapp-vite-wevu-template
- workspace: .tmp/wevu-template-hmr-workspace
- iterations: 1
- budget: 500 ms
- max profile total: 304.38 ms
- max observed wall: 305.47 ms
- over-budget scenarios: 0/13

| group | scenario | avg profile | max profile | avg wall | max wall | pending | emitted | dirty reason | pending reason | status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| page | pages/index definePageJson | 131.75 ms | 131.75 ms | 305.47 ms | 305.47 ms | 1 | 1 | entry-json-only:1 x1 | - | ok |
| page | pages/index script setup | 141.92 ms | 141.92 ms | 304.76 ms | 304.76 ms | 3 | 3 | entry-direct:1 x1 | shared-chunk(wevu-ref.js,wevu-src.js+)+3:direct x1 | ok |
| page | pages/index template | 125.51 ms | 125.51 ms | 203.57 ms | 203.57 ms | 1 | 1 | entry-local-asset:1 x1 | - | ok |
| page | pages/index style | 111.24 ms | 111.24 ms | 203.58 ms | 203.58 ms | 1 | 1 | entry-local-asset:1 x1 | - | ok |
| page | pages/layouts definePageJson | 202.37 ms | 202.37 ms | 202.37 ms | 202.37 ms | - | - | - | - | ok |
| page | pages/layouts template | 124.75 ms | 124.75 ms | 203.19 ms | 203.19 ms | 1 | 1 | entry-local-asset:1 x1 | - | ok |
| layout | layouts/default template | 203.16 ms | 203.16 ms | 203.16 ms | 203.16 ms | - | - | - | - | ok |
| layout | layouts/default style | 145.96 ms | 145.96 ms | 302.93 ms | 302.93 ms | 4 | 4 | layout-self:1 x1<br>layout-dependent:1 x1 | layout-propagation x1<br>shared-chunk(wevu-src.js,wevu-router.js+)+3:dependency x1 | ok |
| layout | layouts/admin script | 303.82 ms | 303.82 ms | 303.82 ms | 303.82 ms | - | - | - | - | ok |
| app | app defineAppJson | 304.38 ms | 304.38 ms | 304.38 ms | 304.38 ms | - | - | - | - | ok |
| app | app style | 128.36 ms | 128.36 ms | 302.83 ms | 302.83 ms | 4 | 4 | importer-graph:1 x1 | shared-chunk(wevu-src.js,wevu-router.js+)+4:dependency x1 | ok |
| json | sitemap.json | 203.28 ms | 203.28 ms | 203.28 ms | 203.28 ms | - | - | - | - | ok |
| json | theme.json | 302.89 ms | 302.89 ms | 302.89 ms | 302.89 ms | - | - | - | - | ok |

## Samples

| scenario | sample | total | build-core | transform | write | emit | watch-to-dirty | wall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| pages/index definePageJson | 1 | 131.75 | 128.85 | 19.11 | 1.09 | 0.33 | 1.49 | 305.47 |
| pages/index script setup | 1 | 141.92 | 138.68 | 45.19 | 1.79 | 0.27 | 1.18 | 304.76 |
| pages/index template | 1 | 125.51 | 122.80 | 14.83 | 1.39 | 0.25 | 1.06 | 203.57 |
| pages/index style | 1 | 111.24 | 108.61 | 13.41 | 1.07 | 0.20 | 1.35 | 203.58 |
| pages/layouts definePageJson | 1 | 202.37 | - | - | - | - | - | 202.37 |
| pages/layouts template | 1 | 124.75 | 121.85 | 16.84 | 1.08 | 0.17 | 1.64 | 203.19 |
| layouts/default template | 1 | 203.16 | - | - | - | - | - | 203.16 |
| layouts/default style | 1 | 145.96 | 144.20 | 56.56 | 1.36 | 0.24 | 0.16 | 302.93 |
| layouts/admin script | 1 | 303.82 | - | - | - | - | - | 303.82 |
| app defineAppJson | 1 | 304.38 | - | - | - | - | - | 304.38 |
| app style | 1 | 128.36 | 126.41 | 59.18 | 1.50 | 0.22 | 0.24 | 302.83 |
| sitemap.json | 1 | 203.28 | - | - | - | - | - | 203.28 |
| theme.json | 1 | 302.89 | - | - | - | - | - | 302.89 |
