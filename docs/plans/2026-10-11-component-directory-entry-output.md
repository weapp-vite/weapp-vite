# 组件目录入口的输出归属

## 复现与根因

原 `tabbar-appbar` 用例稳定失败：`usingComponents` 声明 `/components/Test`，解析得到 `components/Test/index.ts`。JSON、WXML、WXSS 已按物理入口生成，但初始逻辑输入仍使用声明中的目录名，脚本因此输出为 `components/Test.js`。物理入口被登记为根输入后，后续 chunk emitter 不再重复发射 `components/Test/index.js`，运行时依赖无法加载。原用例的 26 个非 JS 快照匹配，未修改其断言或快照。

## 实现选择

组件解析后使用配置服务的 `relativeOutputPath` 计算根输入输出名，与资产发射共用路径映射，再仅移除最后一个源码扩展名。这与 chunk emitter 的 `changeFileExtension` 保持一致，保留 `Card.v2.ts`、`index.weapp.vue` 等文件名中的其他后缀。目录与显式 index 声明因此合并到同一个物理输入；原根输入身份和组件登记保留。

保留 app、页面路由、插件主入口及 lib 显式命名契约。没有采用补发第二份脚本：重复发射会增加模块注册歧义，并继续让脚本与资产具有两个输出来源。

## 验证与边界

新增真实临时文件回归覆盖原生 index.ts、SFC index.vue、目录与显式 index 重复声明、配置输出映射，以及多点文件名和带平台后缀的显式 SFC。先确认旧实现失败，再运行修复后的局部回归、原 tabbar 产物加载与快照断言。下游验证前重建 weapp-vite，保留现有预算、性能基线及 runtime 断言。

`load/options.ts` 原先已超过 300 行，本次变更只统一现有解析循环的输出名，未增加新生命周期或重复状态。当前保持该边界，后续可把逻辑输入收集与解析作为独立重构拆分；本次不为行数增加跨模块耦合。
