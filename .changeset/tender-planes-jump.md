---
'@mpcore/simulator': patch
---

重构 `@mpcore/simulator` 的测试结构：将浏览器 e2e 用例独立到 `e2e/` 目录，并新增 `test-d/` + `tsd` 类型验证机制。现在该包具备清晰的单元/集成、浏览器 e2e 与类型契约三层测试入口。
