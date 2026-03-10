---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 issue #327：`weapp.npm.buildOptions` 返回的 `build.outDir` 现在会同时作用于普通 npm 依赖的二次 bundling 产物，以及带 `miniprogram` 字段、原本仅走直接复制流程的小程序 npm 包。这样可以稳定把 `miniprogram_npm` 产物定向输出到指定子包目录，不再出现只有部分依赖生效的情况；同时补充了对应的单测与 `github-issues` e2e 回归用例。
