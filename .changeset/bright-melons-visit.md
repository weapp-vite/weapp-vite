---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序 production 构建下 Web Runtime 自动注入代码的可读性退化问题。现在 `miniprogram` 目标在 production 合并配置中默认关闭 `build.minify`，使注入后的 runtime 安装与局部绑定代码保持可读形态，便于定位线上问题与调试构建产物。同时补充 `github-issues` 的 issue #457 回归用例，锁定注入代码可读输出。
