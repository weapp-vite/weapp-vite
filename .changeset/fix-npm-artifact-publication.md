---
"weapp-vite": patch
"weapp-ide-cli": patch
"@weapp-vite/acceptance": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复独立输出目录的 npm 落位与构建钩子时序，并提前诊断 automator 项目配置。

生产应用的 npm 文件随 bundler 一同输出，支持在 writeBundle 与 closeBundle 中观察最终文件，避免并行拷贝覆盖后处理。原输出树内的相对 npm 映射跟随 outDir，外部映射保持固定。automator 与 acceptance 在缺少或损坏 project.config.json 时提供可操作的项目根配置指引。
