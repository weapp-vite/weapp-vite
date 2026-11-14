# Issue 1334

保留作者提交的最小复现：逻辑表达式 `preview || { ... }` 的末尾对象字面量会与 compact Mustache 的闭合花括号连续拼接。

fixture 只将宿主 AppID 固定为仓库 E2E 使用的 AppID，源码表达式与组件结构保持原样。
