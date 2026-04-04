---
'create-weapp-vite': patch
---

为 `create-weapp-vite` 新增“是否安装推荐本地 AI skills”的初始化选项。交互式创建时默认会提示安装 `sonofmagic/skills`，并在执行前明确展示 `npx skills add sonofmagic/skills`；非交互模式支持通过 `--install-skills` 与 `--no-install-skills` 控制该行为，同时保留创建后手动执行的路径。
