# Issue 1345

保留 issue 报告中的最小 SFC 复现：包含中文注释的 SCSS 会让 Sass 在 WXSS 顶部输出 `@charset "UTF-8";`。

fixture 只将宿主 AppID 固定为仓库 E2E 使用的 AppID，复现样式保持原样。
