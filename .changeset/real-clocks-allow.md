---
'@mpcore/simulator': patch
---

补充 `@mpcore/simulator` 中文件系统 headless runtime 的组件生命周期覆盖，确保自定义组件的 `lifetimes` 与 `pageLifetimes` 在运行时和回归测试中都有明确验证。
