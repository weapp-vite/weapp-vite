---
'@mpcore/simulator': patch
'@mpcore/vitest': minor
'@weapp-vite/miniprogram-automator': patch
'weapp-ide-cli': patch
---

对齐 mpcore Node/浏览器模拟器的原生生命周期、插槽和导航行为，并完善独立测试产物及会话释放。

- Component 页面同时声明顶层生命周期和 pageLifetimes 时不再重复回调；双向派发页面事件。`navigateTo` 的 success/complete 等待目标 ready 与渲染提交后执行。
- 插槽投影保留事件，attached 同步事件沿承载者传播；`selectOwnerComponent()` 遵循 `wx://component-export`，测试桥仍可访问原始实例。
- 声明生命周期独立于可见投影：初始关闭的默认/具名插槽仍创建有效子组件，关闭不卸载、删除声明才释放；转发复用声明，循环按宿主归一化的有效 key 保持实例身份并无损编码 UTF-16 地址。
- 对齐私有模板构造、created、初始 observer 和 attached 的顺序；隐藏声明可查询但不进入组合可见树或被就绪探针误报为正尺寸节点。
- 挂载期间父级写入、条件插入与 observer 重入会同步最新有效属性，避免旧遍历覆盖兄弟节点。created 中 setData 后仍保留私有子树构造/属性交付边界；卸载写入不引发重入循环，事务刷新改为迭代避免兄弟 attached 写入累积调用栈。
- WXML 插值前移除标签间静态换行缩进，保留绑定表达式生成的显式空格，Node/browser 行为一致。
- 新增中立构建/监听与不会加载测试线程 runtime 的 Vitest 配置入口，当前项目注入产物并在更新完成后重跑自身用例；无参 fixture 创建独立 runtime，不重复合并 setup，关闭等待异步启动、回调及所属 watcher。
- headless 会话提供同步幂等 `disconnect()`，释放所属 runtime，包括启动取消后迟到的资源，保留其他项目；外部 automator bridge 登记会话供 CLI 安全复用。
