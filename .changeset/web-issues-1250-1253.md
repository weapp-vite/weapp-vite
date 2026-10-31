---
"@weapp-core/constants": patch
"@mpcore/simulator": minor
"@weapp-vite/web": minor
"@wevu/compiler": patch
"create-weapp-vite": patch
"weapp-vite": patch
---

feat(web): 补齐平台 API、桌面触摸和下拉刷新预览，完善原始模板诊断。

- 增加基于浏览器音频的 `createInnerAudioContext` 和字节/Base64 转换，补齐性能、实时日志、键盘、内存、调试与息屏等 API 的调用入口，并明确无法等价实现的微信能力及降级告警。
- 按每次输入处理鼠标主键拖动和真实触摸，保留触摸坐标、现代 2D Canvas 的相对坐标与事件形状，释放取消、失焦和卸载后的交互资源，查询 Canvas 节点可直接绘制。
- 为 `scroll-view` 增加浏览器平滑定位和基础 refresher，区分显式受控数据提交与无关重渲染；刷新完成后即使数据原值已为 `false`，再次提交也能正确收回。
- legacy 模板更新保留未变化的节点与组件状态，避免父级数据更新在原生事件传播途中拆除后续监听，并保留原生组件自行维护的 DOM 和样式。
- 开发服务区分未知标签和未适配官方组件，诊断定位到 WXML、layout、include/import 及内联/外部 SFC 原始模板，并按入口注册作用域检查依赖；复用告警级别与去重配置，生产构建保持静默，并修复 polling 模式的真实保存热更新。
- 同步 simulator 的受控属性提交、原生刷新状态与测试桥接，保留编译器原始标签来源，并更新随包配置说明及脚手架版本联动。
