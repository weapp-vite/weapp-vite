# @weapp-vite/hmr

实验性的 Node 侧 HMR 编译与交付内核。宿主提供 DevEngine、监听、编译策略、原生输出和运行时协议；本包不依赖 Vite、Rolldown、Tailwind 或框架运行时。

- `HmrCompilerHost` 按实际读取的源码封存版本，并协调可选 `prepareHmr` provider。
- `captureHmrBatch` / `transformHmrBatch` 保留每个 client、补丁顺序、同名文件的不同版本与元数据，单独组合 sourcemap。
- `HmrAssetStore` 记录最后成功提交的字节与部分写入状态；宿主串行调用 `commit`，并通过原生 emit/write 持久化变更和删除。可传入第三个参数 `retainedFileNames`，保护已经转交给宿主 chunk 所有者的同名产物。
- `HmrTransaction` 区分准备、资产提交、持久发布与应用确认；`acknowledge` 不需要排入发布队列，过期和重复回报不改变状态。
- `HmrDeliveryCoordinator` 为需要自有交付队列的宿主提供串行协调。已有队列的宿主直接使用事务，避免叠加调度所有者。

`publish` 回调完成只代表宿主定义的发布边界。VPT 的 DevEngine 通知在持久发布后进行，应用回报继续由 PatchJournal 管理；weapp-vite 的适配器继续等待真实运行时确认。公共包不统一两者的传输协议。

API 为实验版本；发布应用前应使用本包类型与真实 DevEngine 验证自己的宿主适配器。
