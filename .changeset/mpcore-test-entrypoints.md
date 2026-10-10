---
'@mpcore/vitest': minor
---

feat(mpcore): 新增中立产物构建与监听接口，以及不会加载测试线程 runtime 的 Vitest 配置入口。

- 新增中立构建/监听与不会加载测试线程 runtime 的 Vitest 配置入口，当前项目注入产物并在更新完成后重跑自身用例；无参 fixture 创建独立 runtime，不重复合并 setup，关闭等待异步启动、回调及所属 watcher。
