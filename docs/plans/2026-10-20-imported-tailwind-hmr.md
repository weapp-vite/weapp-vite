# 导入式 Tailwind 样式的状态化 HMR

## 问题与边界

普通 CSS 或 Vue style block 导入受管 Tailwind 入口后，原有实现只登记 core root，没有登记状态化 HMR root。provider 因导入式 root 非空而拒绝每个 preparation，使普通 CSS 修改也进入完整重载，丢失页面状态。

修复保留导入式样式的完整 CSS 返回值。资源 URL、用户 PostCSS、scoped 选择器和最终文件写出继续由 Vite 管线负责，不为导入式样式新增占位标记、按异步完成顺序分配输出槽位，或手写输出文件。

## 输入与所有权

- 受管配置入口沿用数字索引；导入式入口使用规范化文件路径和 Vue style index 作为稳定内部 key。
- 生成开始即撤销旧入口的 preparation，保留待磁盘生成时冲刷的 core 内容失效记录。成功完成 CSS 处理和依赖登记后，入口才可用于新的 preparation。
- provider 使用完整冻结来源生成 Tailwind snapshot，交给脚本与模板转换。导入式 preparation 不拼接 CSS 资产，而是要求现有原生快照重建；仅修改脚本候选的批次也遵守这条规则。
- 原生快照前后核对同一入口拓扑、注册 generation、配置、完整来源文件集合、CSS 依赖及文件版本。快照实际读取的源码与冻结输入不一致时拒绝交付，避免混入不同版本。
- 快照当前消费的文件记录使用同一冻结来源身份临时绑定到上述验证，不因文件在构建结束前被删除而丢失准入证据；构建完成或失败后解除绑定。
- `prepareTailwindRoots` 的可选 observer 在生成和缓存命中时均交接实际内存请求。宿主在首个异步边界前深复制 CSS、来源与选项，并按稳定 owner key 封存 `rawCss/css/dependencies/snapshot` 投影。
- 快照中的原始 CSS transform 对 owner、完整有效请求、解析 base、选项和来源身份逐一准入，再使用本批冻结投影；未知或缺失 root 拒绝交付。此阶段不再次扫描磁盘，不能混入仅短暂存在于 core 内部的候选；后续 URL、PostCSS、scoped 和最终 emit/write 继续由原生管线完成。
- 仅含本批准入错误的 Rolldown 包装恢复为原始 resync；其他构建错误保持原样。
- 批次编译和显式 refresh 共用准入 wrapper，失败继续沿用各自的 preparation 释放逻辑，并保留原始 Vite/PostCSS 错误。

## 验证与拆分决定

回归覆盖普通 CSS、脚本候选、完整 SFC style signature、候选或依赖漂移、新来源、入口替换或删除、配置变化、延迟内容失效和 refresh 释放。真实 Vite 集成检查资源 emit/URL 改写、PostCSS、多入口反向完成顺序与小程序 scoped 输出。最终 runtime 验收由同一场景的 headless 与真实微信 IDE 覆盖完成。

`tailwindcss.ts` 和 `hmr.ts` 原有文件均超过 300 行。本次将新增的磁盘准入和 preparation 生命周期分别放入 `tailwindcss/importedValidation.ts` 与 `tailwindcss/importedPreparation.ts`，保持插件入口和既有 HMR 状态机的单一所有权；不在修复时同时重排整套既有插件钩子。
