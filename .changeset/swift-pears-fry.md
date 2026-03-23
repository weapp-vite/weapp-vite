---
'rolldown-require': patch
---

升级 `rolldown-require` 对 `get-tsconfig` 的依赖版本，并完成构建与测试验证。该升级用于保持 tsconfig 解析链路与上游兼容性，包含 `tsconfig paths` 在内的现有解析行为未出现回归。
