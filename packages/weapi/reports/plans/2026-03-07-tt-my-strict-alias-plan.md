# weapi 严格等价异名映射计划（tt + my 优先筛选）

> 生成时间：2026-03-07
> 目标：仅落地“可证明严格等价”的异名映射；其余全部保持 unsupported。

## 1. 硬约束

1. 仅当以下条件同时满足才允许映射：

- 类型可对齐：参数必填/可选、返回关键字段可无损映射。
- 语义可对齐：调用目标与业务域一致，不是“看起来像”。
- 失败可对齐：不能等价的参数组合必须显式 `not supported`。

2. 不以名称相似作为依据，不做“半映射”。

3. 每个落地映射必须补齐：

- 单测：`resolveTarget` + 调用成功路径 + 负向不支持路径。
- tsd：`wpi.<method>` 类型可用。
- 文档：`README` 与 `reports/api-compat/*` 同步。

## 2. 候选总览（已按严格等价口径重筛）

| 优先级 | 平台  | 微信 API                                                            | 候选目标                  | 结论      | 结论依据                                                                                                    |
| ------ | ----- | ------------------------------------------------------------------- | ------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| P1     | my    | `hideHomeButton`                                                    | `hideBackHome`            | ✅ 可执行 | 两侧语义都为“隐藏返回首页入口”；均为可选入参 + 无业务返回数据。                                             |
| P2     | tt    | `getAccountInfoSync`                                                | `getEnvInfoSync`          | ❌ 否决   | `envType` 仅为 `string` 且 `plugin` 为 `Record<string, unknown>`，无法证明满足微信 `AccountInfo` 严格契约。 |
| R1     | tt    | `getEnterOptionsSync`                                               | `getLaunchOptionsSync`    | ❌ 否决   | `getLaunchOptionsSync` 表示启动参数且不随运行变化，无法覆盖 `getEnterOptionsSync` 的“热启动入参”语义。      |
| R2     | tt/my | `requestSubscribeDeviceMessage` / `requestSubscribeEmployeeMessage` | `requestSubscribeMessage` | ❌ 否决   | 参数模型、业务场景、返回结构均不一致，且微信文档明确存在接口级差异。                                        |
| R3     | tt/my | `showShareImageMenu`                                                | `showShareMenu`           | ❌ 否决   | 前者是“分享指定图片”，后者是“开启页面分享按钮”，能力目标不同。                                              |
| R4     | tt    | `openChannelsUserProfile`                                           | `openAwemeUserProfile`    | ❌ 否决   | 视频号与抖音主页属于不同业务域，非同能力替代。                                                              |
| R5     | my    | `scanCode`                                                          | `scan`                    | ❌ 否决   | 结果字段缺失（如 `path`/`charSet`）且返回结构不一致，无法无损对齐。                                         |
| R6     | my    | `chooseAddress`                                                     | `getAddress`              | ❌ 否决   | `getAddress` 为 `resultStatus/result` 包装且字段模型不同（如 `fullname/mobilePhone`），非严格同构。         |
| R7     | my    | `getWeRunData`                                                      | `getRunData`              | ❌ 否决   | 微信返回 `encryptedData/iv`，支付宝要求 `countDate` 且返回 `response`，协议模型不同。                       |
| R8     | my    | `startSoterAuthentication`                                          | `startIfaaAuthentication` | ❌ 否决   | 认证协议字段与结果载荷差异大，非严格等价。                                                                  |

## 3. 批次执行计划（待会可一口气执行）

### 批次 A（直接可做）

1. `my.hideBackHome` 映射到 `wx.hideHomeButton`

- 修改 `methodMapping.ts`：
- my 平台 `hideHomeButton.target` 从 `hideHomeButton` 改为 `hideBackHome`。
- 策略文本改为“映射到 `my.hideBackHome`”。
- 测试补齐：
- `resolveTarget('hideHomeButton')` 指向 `hideBackHome`。
- my 侧调用成功触达 `hideBackHome`。
- 无 `hideBackHome` 时返回 `not supported`。

### 批次 B（证据冲刺，不预设通过）

1. 复核 `tt.getEnvInfoSync` 是否可严格承接 `getAccountInfoSync`

- 必须拿到可证明项：
- `envType` 与微信 `envVersion` 的值域一致性。
- `plugin` 对象结构是否满足微信 `Plugin` 最小字段契约。
- 若任一项无法证明：直接归入否决，不实现映射。

### 批次 C（结论固化）

1. 将 R1-R8 保持 unsupported 的理由写入计划/报告，避免后续重复回滚争议。

## 4. 本次执行结果（2026-03-08）

1. 批次 A：已执行并通过。

- `hideHomeButton` 在支付宝侧已映射到 `my.hideBackHome`。
- 单测、类型测试、文档同步、报告生成、lint、build 全部通过。

2. 批次 B：已完成证据复核并否决映射。

- `tt.getEnvInfoSync` 的 typings 无法严格证明 `miniProgram.envVersion` 与 `plugin` 子结构契约可对齐。
- 按“仅严格等价可映射”规则，保持 `getAccountInfoSync` 在 tt 侧 unsupported。

3. 批次 C：已完成“否决映射防回归”测试固化。

- 已新增并通过单测，确保以下“同功能异名候选”保持 unsupported，且不会误调用近似 API：
- `my.getWeRunData` 不映射 `my.getRunData`
- `my.startSoterAuthentication` 不映射 `my.startIfaaAuthentication`
- `my/tt.showShareImageMenu` 不映射 `showShareMenu`
- `tt.openChannelsUserProfile` 不映射 `tt.openAwemeUserProfile`
- 已有测试同时覆盖：
- `my.chooseAddress` 不映射 `my.getAddress`
- `my.scanCode` 不映射 `my.scan`
- `tt.getEnterOptionsSync` 不映射 `tt.getLaunchOptionsSync`
- `tt.getAccountInfoSync` 不映射 `tt.getEnvInfoSync`
- `my/tt.requestSubscribeDeviceMessage|requestSubscribeEmployeeMessage` 不映射 `requestSubscribeMessage`
- `my/tt.createAudioContext|createWebAudioContext` 不映射 `createInnerAudioContext`
- `my/tt.onNetworkWeakChange|offNetworkWeakChange` 不映射 `onNetworkStatusChange|offNetworkStatusChange`
- `my/tt.getBackgroundFetchToken` 不映射 `getBackgroundFetchData`

4. 批次 D：已完成支付宝 BLE 严格等价映射。

- `my.connectBLEDevice` 映射承接 `wx.createBLEConnection`。
- `my.disconnectBLEDevice` 映射承接 `wx.closeBLEConnection`。
- 入参 `deviceId/timeout` 可直接对齐，返回结果 `error|errorCode/errorMessage` 已规范化为 `errCode/errMsg`。
- `my.getSystemInfo` 映射承接 `wx.getSystemInfoAsync`。
- 抖音侧仍保持 unsupported（无同等 API）。

5. 截至当前版本的剩余“近名候选”（全部已锁定 unsupported）

- `my.getWeRunData` vs `my.getRunData`
- `my.showShareImageMenu` vs `my.showShareMenu`
- `my.startSoterAuthentication` vs `my.startIfaaAuthentication`
- `tt.openChannelsUserProfile` vs `tt.openAwemeUserProfile`
- `tt.showShareImageMenu` vs `tt.showShareMenu`

6. 自动复筛结论（2026-03-08）

- 已对当前 unsupported 清单执行“名称相似度 + 类型双向可赋值 + 人工语义复核”组合筛选。
- 结果：除第 5 节候选外，未发现新的可证明“严格等价异名映射”项。
- 噪声候选示例：`on/offBLEPeripheralConnectionStateChanged` 与 `on/offBLEConnectionStateChanged` 名称近似，但外围设备与中心设备事件语义不同，已按非严格等价处理并以单测锁定 unsupported。

7. 原始 typings 反查证据补充（2026-03-08）

- 已对高相似度候选做声明级反查（`@douyin-microapp/typings`、`@mini-types/alipay`、`miniprogram-api-typings`）：
- `tt` 侧未导出 `createBLEConnection` / `closeBLEConnection` / `connectBLEDevice` / `disconnectBLEDevice`，无法承接微信 BLE 连接接口。
- `tt` 侧仅导出 `saveImageToPhotosAlbum`，未导出 `saveVideoToPhotosAlbum`；`setting.d.ts` 中关于 `saveVideoToPhotosAlbum` 的出现仅为注释文本，不是 API 声明。
- `tt.getEnvInfoSync` 仍无法提供微信 `getAccountInfoSync` 所需的 `miniProgram.envVersion` 与 `plugin` 结构契约。
- `my.openSetting` 与 `wx.openAppAuthorizeSetting` 虽名称相近，但前者返回授权配置载荷且语义锚点更接近 `wx.openSetting`，不作为 `openAppAuthorizeSetting` 的严格等价映射。

8. 策略防回归状态（2026-03-08）

- 已增加矩阵级白名单测试，限定 `target !== method` 的异名映射仅允许当前可证明严格等价项（my 12 项 + tt 1 项）。
- 已增加矩阵级断言：`my/tt` 两端 fallback 映射数必须恒为 `0`，防止重新引入“近名兜底映射”。
- 已补充事件类误映射防回归：
- `tt.offMemoryWarning` 缺失时不得回退到 `onMemoryWarning`。
- `my/tt` 的 `on/offAppRoute` 与 `on/offAppRouteDone` 缺失时不得回退到 `on/offAppShow`。
- 已补充 Wi-Fi / 通讯录相关误映射防回归：
- `tt.onWifiConnected` / `tt.offWifiConnected` / `tt.setWifiList` 缺失时不得回退到 `onGetWifiList` / `offGetWifiList` / `getConnectedWifi` / `getWifiList`。
- `tt.chooseContact` 缺失时不得回退到 `chooseAddress`。
- `my.addPhoneCalendar` 缺失时不得回退到 `addPhoneContact`。
- `my/tt` 的 `on/offWifiConnectedWithPartialInfo` 缺失时不得回退到 `on/offWifiConnected` 或 `on/offGetWifiList`。

9. 门禁脚本接入（2026-03-08）

- 已新增 `scripts/check-strict-alias-guard.mjs`，用于独立校验：
- `my/tt` 异名映射是否严格匹配白名单（my 12 项、tt 1 项）。
- 所有异名映射是否保持 `supportLevel=mapped` 且 `semanticAligned=true`。
- fallback 映射数量是否为 `0`。
- 已在 `package.json` 新增 `strict-alias:check`，并接入 `prebuild`，确保构建前自动执行门禁。

10. 最新候选复筛（2026-03-08）

- 已按“unsupported + 名称相似度 >= 0.75”重新扫描并人工复核，未发现新增可证明严格等价映射。
- 本轮高相似但仍否决的代表项：
- `tt.saveVideoToPhotosAlbum` vs `tt.saveImageToPhotosAlbum`（能力对象不同，视频/图片不可等价）。
- `tt.getEnterOptionsSync` vs `tt.getLaunchOptionsSync`（冷启动/热启动语义差异）。
- `tt.openChannelsUserProfile` vs `tt.openAwemeUserProfile`（业务域不同）。
- `my.openAppAuthorizeSetting` vs `my.getAppAuthorizeSetting/openSetting`（语义锚点不一致）。

## 5. 每批固定验证清单

1. `pnpm --filter @wevu/api test`
2. `pnpm --filter @wevu/api test:types`
3. `pnpm --filter @wevu/api strict-alias:check`
4. `pnpm --filter @wevu/api docs:sync`
5. `pnpm --filter @wevu/api report:api`
6. `pnpm --filter @wevu/api lint`
7. `pnpm --filter @wevu/api build`
8. 新增 changeset（中文摘要）
9. 仅提交 `packages/weapi` + `.changeset/*.md`
