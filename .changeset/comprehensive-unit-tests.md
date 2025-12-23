---
"wevu": patch
"@weapp-vite/plugin-wevu": patch
---

为 wevu 和 plugin-wevu 添加完整的单元测试覆盖

- wevu: 新增 provide/inject、生命周期钩子、readonly 和 reactive 的边界值测试，覆盖率从 82% 提升至 87%
- plugin-wevu: 新增编译器的错误处理、边界情况和特殊字符测试，覆盖率从 81% 提升至 91%
- 所有测试关注边界值情况，包括 null、undefined、空值、特殊字符、并发场景等
- 总计新增 159 个测试用例，所有测试均通过
