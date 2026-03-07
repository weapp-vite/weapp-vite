---
'@wevu/api': minor
---

整合 weapi 跨端对齐与严格兼容相关 changeset（含此前 patch 与 minor 变更）。

## 合并来源
- afraid-seas-sparkle.md
- blue-forks-sneeze.md
- bright-apples-fold.md
- brown-tomatoes-peel.md
- calm-ligers-flow.md
- chilly-pandas-kiss.md
- clean-rabbits-wave.md
- clever-cups-hammer.md
- cold-pens-swim.md
- cool-chips-trade.md
- cool-coins-stay.md
- cool-yaks-remember.md
- curly-hotels-knock.md
- curly-owls-divide.md
- dirty-seahorses-explain.md
- early-meals-draw.md
- eight-lobsters-serve.md
- eighty-snakes-cheat.md
- empty-squids-live.md
- fair-bananas-rhyme.md
- fair-moles-visit.md
- fair-oranges-stop.md
- fair-peas-argue.md
- fair-seahorses-compete.md
- five-kiwis-join.md
- flat-planets-scream.md
- fluffy-oranges-sip.md
- forty-books-tie.md
- four-moose-live.md
- fresh-emus-judge.md
- fresh-lamps-boil.md
- funny-beds-visit.md
- funny-gorillas-admire.md
- fuzzy-plums-sip.md
- gentle-nails-raise.md
- green-snails-clean.md
- hungry-carpets-repeat.md
- long-baboons-kiss.md
- loud-boats-fail.md
- mean-tips-whisper.md
- new-files-clean.md
- new-oranges-film.md
- nice-goats-share.md
- ninety-pumas-wave.md
- odd-icons-turn.md
- odd-radios-dance.md
- odd-radios-teach.md
- orange-seas-smash.md
- orange-spoons-wave.md
- perfect-weeks-count.md
- polite-cameras-jam.md
- pretty-cobras-heal.md
- quick-lamps-clean.md
- quiet-candles-punch.md
- quiet-pants-think.md
- real-taxis-join.md
- seven-lamps-lick.md
- short-books-kick.md
- short-nails-applaud.md
- silent-fans-develop.md
- six-mangoes-shout.md
- sixty-bears-ring.md
- slimy-timers-lie.md
- soft-walls-clap.md
- solid-forks-sparkle.md
- spicy-lobsters-ring.md
- strong-spoons-smile.md
- tall-hounds-marry.md
- ten-shrimps-joke.md
- tidy-rabbits-kick.md
- tiny-laws-decide.md
- tiny-plums-roll.md
- tough-zoos-call.md
- twelve-colts-drum.md
- two-pumpkins-fetch.md
- weak-ravens-relax.md
- wet-baboons-train.md
- wise-oranges-fly.md

## 变更摘要
1. **afraid-seas-sparkle.md**：继续移除 `@wevu/api` 的非等价重启能力映射：`restartMiniProgram` 在支付宝与抖音侧不再映射到 `reLaunch`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
2. **blue-forks-sneeze.md**：继续补齐 `@wevu/api` 第二批高频 API 对齐：新增 `login`、`chooseVideo`、`hideHomeButton`、`getWindowInfo`、`getDeviceInfo`、`getAccountInfoSync` 的跨端映射，并补充参数/返回值语义转换（如 `chooseMedia` 结果对齐为 `chooseVideo` 结构、`getEnvInfoSync` 对齐为账号信息结构）。同时更新单元测试、类型文档矩阵与兼容报告，进一步提升三端按微信命名调用的可用覆盖率。
3. **bright-apples-fold.md**：修正跨端 API 的 fallback 策略：移除将不等价事件 API 近似映射到 `onAppShow/offAppShow` 的行为，并默认关闭通用 fallback。 当目标平台缺少对应 API 且不存在功能等价显式映射时，`weapi` 现在会按 `unsupported` 处理并在调用时返回标准 not supported 错误，避免“可调用但语义错误”的假对齐。
4. **brown-tomatoes-peel.md**：继续移除 `@wevu/api` 的非等价订阅消息映射：`requestSubscribeDeviceMessage` 与 `requestSubscribeEmployeeMessage` 在支付宝与抖音侧不再映射到 `requestSubscribeMessage`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
5. **calm-ligers-flow.md**：继续提升 `weapi` 三端语义对齐：为 `openCard`、`openChannelsActivity`、`openChannelsEvent`、`openChannelsLive`、`openChannelsLiveNoticeInfo`、`openChannelsUserProfile`、`openChatTool`、`openHKOfflinePayView`、`openInquiriesTopic`、`openOfficialAccountArticle`、`openOfficialAccountChat`、`openOfficialAccountProfile`、`openPrivacyContract`、`openSystemBluetoothSetting`、`reportEvent`、`reportMonitor`、`reportPerformance` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步降低支付宝与抖音 fallback 缺口。
6. **chilly-pandas-kiss.md**：继续移除 `@wevu/api` 的非等价分享能力映射：`showShareImageMenu`、`updateShareMenu` 在支付宝/抖音侧不再映射到 `showSharePanel`/`showShareMenu`，统一改为在无同等 API 时返回 unsupported。同步更新测试、类型注释与兼容报告。
7. **clean-rabbits-wave.md**：继续提升 `weapi` 三端语义对齐：为 `chooseInvoiceTitle`、`chooseLicensePlate`、`choosePoi`、`closeBLEConnection`、`createBLEConnection`、`cropImage`、`editImage`、`exitVoIPChat`、`faceDetect`、`getApiCategory`、`getBackgroundFetchToken`、`getChannelsLiveInfo`、`getChannelsLiveNoticeInfo`、`getChannelsShareKey`、`getChatToolInfo`、`getCommonConfig`、`getGroupEnterInfo`、`getPrivacySetting`、`initFaceDetect`、`join1v1Chat` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步减少支付宝与抖音 fallback 缺口。
8. **clever-cups-hammer.md**：改进 weapi 的网络请求兼容行为：新增默认超时与 `__wxConfig.networkTimeout` 读取、请求级 `timeout` 优先级处理、`referer` 头过滤、`request/uploadFile/downloadFile` 并发上限（10）与 `connectSocket` 并发上限（5），并将并发溢出策略调整为默认 `queue`（可通过 `network.overflowPolicy: 'strict'` 切换为超限即失败），同时补充前后台切换下的 `fail interrupted` 语义与回归测试。
9. **cold-pens-swim.md**：继续移除 `@wevu/api` 中剩余的 synthetic fallback：`reportAnalytics`（支付宝侧）、`onWindowResize`/`offWindowResize`（支付宝侧）以及 `offMemoryWarning`（抖音侧）在无同等 API 时统一改为 unsupported；同时删除 `createWeapi` 内对应 synthetic 运行时桥接逻辑，保持“仅同等能力可映射，否则直接报错”的策略一致性。
10. **cool-chips-trade.md**：继续补齐 `@wevu/api` 的高频跨端同义 API 映射，新增 20 组微信命名到支付宝/抖音目标 API 的对齐规则（如 `pluginLogin` -> `my.getAuthCode` / `tt.login`、`openEmbeddedMiniProgram` -> `navigateToMiniProgram`）。同时补充对应单元测试、类型文档矩阵与兼容报告生成产物，提升按微信命名调用时的三端覆盖率与一致性。
11. **cool-coins-stay.md**：继续移除 `@wevu/api` 的非等价文件能力映射：`saveFileToDisk` 在抖音侧不再映射到 `saveFile`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
12. **cool-yaks-remember.md**：继续提升 `weapi` 三端语义对齐：为 `openSingleStickerView`、`openStickerIPView`、`openStickerSetView`、`openStoreCouponDetail`、`openStoreOrderDetail`、`pauseBackgroundAudio`、`pauseVoice`、`playBackgroundAudio`、`playVoice`、`postMessageToReferrerMiniProgram`、`postMessageToReferrerPage`、`preDownloadSubpackage`、`preloadAssets`、`preloadSkylineView`、`preloadWebview`、`removeSecureElementPass` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步降低支付宝与抖音 fallback 缺口。
13. **curly-hotels-knock.md**：继续推进 `weapi` 三端语义对齐，补充 `batchSetStorage`、`batchGetStorage`、`batchSetStorageSync`、`batchGetStorageSync`、`createCameraContext`、`offMemoryWarning`、`cancelIdleCallback` 的显式映射与 synthetic 运行时兼容；同步新增对应单测并更新类型文档与兼容性报告，进一步降低 fallback 数量并提升三端语义对齐率。
14. **curly-owls-divide.md**：继续收紧 `weapi` 的严格兼容策略：移除支付宝/抖音对 `openCustomerServiceChat`、`compressVideo`、`openVideoEditor`、`getShareInfo`、`joinVoIPChat`，以及抖音 `openDocument` 的 synthetic 成功 shim。上述 API 在对应平台缺失时统一返回 unsupported 错误，仅保留功能完全一致的映射；并同步更新单元测试、类型文档与兼容性报告。
15. **dirty-seahorses-explain.md**：继续补齐 `@wevu/api` 的媒体与广告语义映射：新增 `previewMedia`、`createInterstitialAd`、`createRewardedVideoAd`、`createLivePlayerContext`、`createLivePusherContext`、`getVideoInfo` 的支付宝/抖音显式映射与参数对齐（如 `sources.url -> urls`、`src -> filePath`、`adUnitId` 入参规范化）。同时补充单元测试与兼容报告更新，进一步降低 fallback 依赖并提升三端语义对齐覆盖率。
16. **early-meals-draw.md**：继续提升 `weapi` 三端语义对齐：为 `requestCommonPayment`、`requestDeviceVoIP`、`requestMerchantTransfer`、`requirePrivacyAuthorize`、`reserveChannelsLive`、`selectGroupMembers`、`sendHCEMessage`、`sendSms`、`setBackgroundFetchToken`、`setEnable1v1Chat`、`setTopBarText`、`setWindowSize`、`stopHCE`、`stopLocalServiceDiscovery`、`stopLocationUpdate`、`stopRecord`、`stopVoice`、`subscribeVoIPVideoMembers`、`updateVoIPChatMuteConfig`、`updateWeChatApp` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步减少支付宝与抖音 fallback 缺口。
17. **eight-lobsters-serve.md**：增强 `weapi` 三端语义对齐能力，补充 `chooseMedia`、`chooseMessageFile`、`setBackgroundColor`、`setBackgroundTextStyle`、`getNetworkType`、`getBatteryInfo`、`getBatteryInfoSync` 的跨端映射与参数/结果归一化；同时新增对应单元测试、类型文档矩阵与 API 兼容性报告更新，提升支付宝与抖音在微信命名下的可调用一致性与语义覆盖。
18. **eighty-snakes-cheat.md**：继续移除 `@wevu/api` 的非等价系统信息映射：`getNetworkType`、`getBatteryInfo`、`getBatteryInfoSync` 在抖音侧不再映射到 `getSystemInfo/getSystemInfoSync`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
19. **empty-squids-live.md**：继续提升 `weapi` 三端语义对齐：将 `onAfterPageLoad`、`onAfterPageUnload`、`onApiCategoryChange`、`onAppRoute`、`onAppRouteDone`、`onBackgroundAudioPause`、`onBackgroundAudioPlay`、`onBackgroundAudioStop`、`onBackgroundFetchData`、`onBatteryInfoChange`、`offAfterPageLoad`、`offAfterPageUnload`、`offApiCategoryChange`、`offAppRoute`、`offAppRouteDone`、`offBatteryInfoChange`、`offBeforeAppRoute`、`offBeforePageLoad`、`offBeforePageUnload`、`offBLEConnectionStateChange` 从通用 fallback 升级为显式跨端映射（`onAppShow/offAppShow` 近似策略）；同步补充运行时单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步降低 fallback 缺口。
20. **fair-bananas-rhyme.md**：修复 `WeapiPromisify` 对“可选尾参”方法的类型推导：`getSystemInfoAsync` 等接口在类型层不再错误退化为 `Promise<void>`，恢复为与微信定义一致的返回值。同步收敛 `WeapiInstance` 类型组合与 `tsd` 断言，避免重载交叉导致的返回类型不稳定。
21. **fair-moles-visit.md**：为 `@wevu/api` 增加兼容能力分级与严格模式：`resolveTarget` 新增 `supportLevel/semanticAligned`，`supports` 支持语义模式判断；`createWeapi` 新增 `strictCompatibility` 选项用于关闭通用 fallback。并将兼容报告升级为“双指标”视图（可调用覆盖率 + 语义对齐覆盖率），同时输出各平台 fallback 方法规模，便于在高覆盖与高语义一致性之间做可观测的取舍。
22. **fair-oranges-stop.md**：继续移除 `@wevu/api` 的非等价认证能力映射：`login`、`authorize`、`checkSession` 在支付宝侧不再映射到 `getAuthCode`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
23. **fair-peas-argue.md**：继续推进 `weapi` 严格兼容策略：移除支付宝/抖音对 `chooseInvoiceTitle`、`chooseLicensePlate`、`choosePoi`、`closeBLEConnection`、`createBLEConnection`、`cropImage`、`editImage`、`exitVoIPChat`、`faceDetect`、`getApiCategory`、`getBackgroundFetchToken`、`getChannelsLiveInfo`、`getChannelsLiveNoticeInfo`、`getChannelsShareKey`、`getChatToolInfo`、`getCommonConfig`、`getGroupEnterInfo`、`getPrivacySetting`、`initFaceDetect`、`join1v1Chat` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
24. **fair-seahorses-compete.md**：继续移除 `@wevu/api` 的非等价用户信息映射：`getUserProfile` 与 `getUserInfo` 在支付宝侧不再映射到 `getOpenUserInfo`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
25. **five-kiwis-join.md**：继续增强 `weapi` 三端兼容层：新增 `nextTick`、`getLogManager`、`reportAnalytics`、`onWindowResize`、`offWindowResize` 的内置 synthetic 对齐能力，补齐 `getFuzzyLocation` 映射，并为抖音 `showActionSheet` 增加 `showModal` 降级 shim。同步更新单元测试、类型文档与兼容性报告，使三端可调用完全对齐达到 100%。
26. **flat-planets-scream.md**：继续收紧 `weapi` 严格兼容策略：移除支付宝/抖音对 `loadBuiltInFontFace`、`notifyGroupMembers`、`requestIdleCallback`、`revokeBufferURL`、`rewriteRoute`、`seekBackgroundAudio`、`setEnableDebug`、`setInnerAudioOption` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
27. **fluffy-oranges-sip.md**：补充支付宝 BLE 连接状态事件的严格等价映射： - `onBLEConnectionStateChange` 对齐到 `my.onBLEConnectionStateChanged` - `offBLEConnectionStateChange` 对齐到 `my.offBLEConnectionStateChanged` 该调整只处理名称差异导致的不一致，不引入任何近似 fallback。抖音端保持 `unsupported`，避免错误语义对齐。
28. **forty-books-tie.md**：继续收紧 `@wevu/api` 的严格兼容策略：移除 `pluginLogin` 在支付宝/抖音侧的异名映射（不再映射到 `getAuthCode/login`），统一改为无同等 API 时返回 unsupported，并同步更新测试、类型注释和兼容报告。
29. **four-moose-live.md**：继续移除 `@wevu/api` 的非等价启动参数映射：`getEnterOptionsSync` 在抖音侧不再映射到 `getLaunchOptionsSync`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
30. **fresh-emus-judge.md**：为 `@wevu/api` 新增运行时能力探测 API：`resolveTarget(method)` 可返回当前平台下的目标方法映射与可调用状态，`supports(method)` 可快速判断微信命名 API 在当前适配器上是否可用。同时在 CI 中补充 `weapi` 专项守卫任务，强制校验 catalog/docs/report 生成结果与单元/类型测试，避免类型源升级后兼容矩阵与报告失真。
31. **fresh-lamps-boil.md**：进一步收紧 weapi 的非等价兼容策略：移除抖音端 `showActionSheet` 缺失时降级 `showModal` 的行为。 现在当 `tt.showActionSheet` 不可用时，会按 `unsupported` 返回标准 not supported 错误；仅在目标平台存在功能等价 API 时才进行显式映射。
32. **funny-beds-visit.md**：继续收紧 `weapi` 严格兼容策略：移除支付宝/抖音对 `shareAppMessageToGroup`、`shareEmojiToGroup`、`shareFileMessage`、`shareFileToGroup`、`shareImageToGroup`、`shareToOfficialAccount`、`shareToWeRun`、`shareVideoMessage`、`shareVideoToGroup`、`showRedPackage`、`startDeviceMotionListening`、`startHCE`、`startLocalServiceDiscovery`、`startLocationUpdate`、`startLocationUpdateBackground`、`startRecord`、`startSoterAuthentication`、`stopBackgroundAudio`、`stopDeviceMotionListening`、`stopFaceDetect` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
33. **funny-gorillas-admire.md**：继续移除 `@wevu/api` 中非等价映射：`chooseMedia` 在支付宝侧不再映射到 `chooseImage`，`chooseMessageFile` 在支付宝/抖音侧不再映射到 `chooseImage`。当平台缺少同等 API 时统一返回 unsupported，并同步删除对应无效转换逻辑、更新单元测试与兼容报告。
34. **fuzzy-plums-sip.md**：继续收紧 `@wevu/api` 的严格兼容策略：移除 `chooseVideo` 在抖音侧映射到 `chooseMedia` 的非等价适配，改为无同等 API 时直接返回 unsupported；同步删除对应无效参数/返回值转换逻辑，更新测试与兼容报告。
35. **gentle-nails-raise.md**：新增 SOTER 查询能力在支付宝端的严格等价映射：`checkIsSoterEnrolledInDevice` 映射到 `my.checkIsIfaaEnrolledInDevice`，`checkIsSupportSoterAuthentication` 映射到 `my.checkIsSupportIfaaAuthentication`。同时对 `speech` 模式补充运行时保护（按不支持报错），并补齐单元测试与兼容报告。
36. **green-snails-clean.md**：继续提升 `weapi` 三端语义对齐：为 `canvasGetImageData`、`canvasPutImageData` 与 `checkDeviceSupportHevc`、`checkEmployeeRelation`、`checkIsAddedToMyMiniProgram`、`checkIsOpenAccessibility`、`checkIsPictureInPictureActive`、`checkIsSoterEnrolledInDevice`、`checkIsSupportSoterAuthentication` 增加显式映射与 synthetic shim；同步补充单元测试与 tsd 类型断言，并更新支持矩阵文档与 API 兼容性报告，进一步减少支付宝/抖音 fallback 缺口。
37. **hungry-carpets-repeat.md**：补齐抖音 API 清单提取逻辑：在原有 `typeof tt` 类型提取基础上，新增从 `@douyin-microapp/typings/api/**/*.d.ts` 的可调用导出中补充方法，修复 `showActionSheet`、`createRewardedVideoAd`、`createMediaRecorder` 等能力被低估的问题。同步更新兼容矩阵与测试断言，提升抖音侧及三端对齐覆盖率统计准确性。
38. **long-baboons-kiss.md**：继续收紧 `weapi` 严格兼容策略：移除支付宝/抖音对 `openSystemBluetoothSetting`、`reportEvent`、`reportMonitor`、`reportPerformance`、`openSingleStickerView`、`openStickerIPView`、`openStickerSetView`、`openStoreCouponDetail`、`openStoreOrderDetail`、`pauseBackgroundAudio`、`pauseVoice`、`playBackgroundAudio`、`playVoice`、`postMessageToReferrerMiniProgram`、`postMessageToReferrerPage`、`preDownloadSubpackage`、`preloadAssets`、`preloadSkylineView`、`preloadWebview`、`removeSecureElementPass` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
39. **loud-boats-fail.md**：继续按严格对齐策略收敛 `@wevu/api`：移除抖音端 `createRewardedVideoAd -> createInterstitialAd` 与 `saveVideoToPhotosAlbum -> saveImageToPhotosAlbum` 的非等价映射，统一改为 unsupported；同时清理 `methodMapping` 中已失效的 synthetic 支持死代码，避免误判平台可用性。
40. **mean-tips-whisper.md**：继续收敛 `@wevu/api` 的严格兼容策略：移除 `previewMedia` 在支付宝/抖音侧映射到 `previewImage` 的非等价适配，统一改为在无同等 API 时返回 unsupported；并删除对应无效参数转换逻辑，同步更新测试和兼容报告。
41. **new-files-clean.md**：继续移除 `@wevu/api` 的非等价扫码映射：`scanCode` 在支付宝侧不再映射到 `scan`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
42. **new-oranges-film.md**：继续移除 `@wevu/api` 的非等价窗口背景映射：`setBackgroundColor` 与 `setBackgroundTextStyle` 在抖音侧不再映射到 `setNavigationBarColor`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
43. **nice-goats-share.md**：新增 `getSystemInfoAsync(wx)` 在抖音端的严格等价映射：转调 `tt.getSystemInfo`，统一按微信命名暴露异步系统信息查询能力。支付宝端仍保持 unsupported。同步补充单元测试、类型注释与兼容矩阵报告。
44. **ninety-pumas-wave.md**：进一步提升 `weapi` 三端语义对齐：新增 `openCustomerServiceChat`、`createVKSession`、`compressVideo`、`openVideoEditor`、`getShareInfo`、`joinVoIPChat`、`openDocument` 的显式映射与 synthetic shim；补充 `saveVideoToPhotosAlbum` 在抖音侧映射到 `saveImageToPhotosAlbum`。同步更新测试、类型文档与兼容性报告，显著降低高频 fallback 缺口。
45. **odd-icons-turn.md**：继续清理 `@wevu/api` 的非等价映射：移除支付宝侧 `createLivePlayerContext`、`createLivePusherContext` 到 `createVideoContext` 的兼容映射，改为在无同等 API 时直接返回 unsupported；并同步更新单元测试、类型注释与兼容报告。
46. **odd-radios-dance.md**：继续提升 `weapi` 三端语义对齐：将 `onBeforeAppRoute`、`onBeforePageLoad`、`onBeforePageUnload`、`onBLEConnectionStateChange`、`onBLEMTUChange`、`onBLEPeripheralConnectionStateChanged`、`onCopyUrl`、`onEmbeddedMiniProgramHeightChange`、`onGeneratePoster`、`onHCEMessage`、`offBLEMTUChange`、`offBLEPeripheralConnectionStateChanged`、`offCopyUrl`、`offEmbeddedMiniProgramHeightChange`、`offGeneratePoster`、`offHCEMessage`、`offKeyboardHeightChange`、`offKeyDown`、`offKeyUp`、`offLocalServiceDiscoveryStop` 从通用 fallback 升级为显式跨端映射（`onAppShow/offAppShow` 近似策略）；同步补充运行时单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步降低 fallback 缺口。
47. **odd-radios-teach.md**：继续收紧 `@wevu/api` 的三端兼容策略：移除 `addPhoneContact`、`openOfficialAccountArticle`、`openOfficialAccountChat`、`openOfficialAccountProfile`、`openPrivacyContract` 在支付宝/抖音端的 synthetic no-op 支持（其中 `addPhoneContact` 保留支付宝直连能力）。当宿主端缺少同等能力时，统一按 unsupported 报错，并同步更新单测、支持矩阵与 API 兼容报告。
48. **orange-seas-smash.md**：继续推进 `weapi` 严格兼容策略：移除支付宝/抖音对 `requestCommonPayment`、`requestDeviceVoIP`、`requestMerchantTransfer`、`requirePrivacyAuthorize`、`reserveChannelsLive`、`selectGroupMembers`、`sendHCEMessage`、`sendSms`、`setBackgroundFetchToken`、`setEnable1v1Chat`、`setTopBarText`、`setWindowSize`、`stopHCE`、`stopLocalServiceDiscovery`、`stopLocationUpdate`、`stopRecord`、`stopVoice`、`subscribeVoIPVideoMembers`、`updateVoIPChatMuteConfig`、`updateWeChatApp` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
49. **orange-spoons-wave.md**：继续移除 `@wevu/api` 的非等价系统设置映射：`getSystemSetting` 与 `getAppAuthorizeSetting` 在抖音侧不再映射到 `getSetting`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
50. **perfect-weeks-count.md**：继续收紧 `weapi` 严格兼容策略：移除支付宝/抖音对 `addCard`、`addFileToFavorites`、`addPaymentPassFinish`、`addPaymentPassGetCertificateData`、`addPhoneCalendar`、`addPhoneRepeatCalendar`、`addVideoToFavorites`、`authorizeForMiniProgram`、`authPrivateMessage`、`bindEmployeeRelation`、`canAddSecureElementPass`、`openCard`、`openChannelsActivity`、`openChannelsEvent`、`openChannelsLive`、`openChannelsLiveNoticeInfo`、`openChannelsUserProfile`、`openChatTool`、`openHKOfflinePayView`、`openInquiriesTopic` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
51. **polite-cameras-jam.md**：继续移除 `@wevu/api` 的非等价广告能力映射：`createRewardedVideoAd` 在支付宝侧不再映射到 `createRewardedAd`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
52. **pretty-cobras-heal.md**：增强支付宝 `showModal` 映射的严格等价约束：当传入 `showCancel=false`、`editable=true` 或 `placeholderText` 等微信独有能力时，改为直接按不支持报错，避免误降级到不等价行为。同时补齐映射异常在 Promise 与 callback 两种调用方式下的单元测试，确保错误返回一致。
53. **quick-lamps-clean.md**：继续提升 `weapi` 三端语义对齐：为 `createBLEPeripheralServer`、`createBufferURL`、`createCacheManager`、`createGlobalPayment`、`createInferenceSession`、`createMediaAudioPlayer`、`createMediaContainer`、`createMediaRecorder`、`createTCPSocket`、`createUDPSocket`、`createVideoDecoder`、`loadBuiltInFontFace`、`notifyGroupMembers`、`requestIdleCallback`、`revokeBufferURL`、`rewriteRoute`、`seekBackgroundAudio`、`setEnableDebug`、`setInnerAudioOption` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步减少支付宝与抖音 fallback 缺口。
54. **quiet-candles-punch.md**：继续移除 `@wevu/api` 的非等价音频上下文映射：`createAudioContext`、`createWebAudioContext` 在支付宝/抖音侧不再映射到 `createInnerAudioContext`，统一改为无同等 API 时返回 unsupported，并同步更新测试、类型注释和兼容报告。
55. **quiet-pants-think.md**：继续移除 `@wevu/api` 的非等价首页按钮映射：`hideHomeButton` 在支付宝侧不再映射到 `hideBackHome`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
56. **real-taxis-join.md**：将支付宝端两组严格等价异名能力对齐到微信命名：`createBLEConnection` / `closeBLEConnection` 分别映射到 `my.connectBLEDevice` / `my.disconnectBLEDevice`（并补充 `error|errorCode/errorMessage` 到 `errCode/errMsg` 的结果规范化），`getSystemInfoAsync` 映射到 `my.getSystemInfo`。同步补齐正反向单测、类型测试与兼容报告更新，抖音侧无同等能力的接口仍保持 unsupported。
57. **seven-lamps-lick.md**：继续移除 `@wevu/api` 的非等价授权设置映射：`openAppAuthorizeSetting` 在支付宝与抖音侧不再映射到 `openSetting`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
58. **short-books-kick.md**：继续推进 `@wevu/api` 语义映射批次：新增 `authorize`、`checkSession`、`requestPayment`、`requestOrderPayment`、`requestPluginPayment`、`requestVirtualPayment` 的支付宝/抖音显式映射与参数对齐（含 `scope -> scopes`、`package -> orderStr/orderInfo`）。同时补充单元测试并更新兼容报告，降低 fallback 依赖，提升三端语义对齐覆盖率。
59. **short-nails-applaud.md**：继续移除 `@wevu/api` 的非等价账号信息映射：`getAppBaseInfo` 与 `getAccountInfoSync` 在抖音侧不再映射到 `getEnvInfoSync`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
60. **silent-fans-develop.md**：继续移除 `@wevu/api` 的非等价设备信息映射：`getWindowInfo` 在抖音侧不再映射到 `getSystemInfo`，`getDeviceInfo` 在支付宝与抖音侧不再映射到 `getSystemInfo`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
61. **six-mangoes-shout.md**：继续移除 `@wevu/api` 的非等价地址能力映射：`chooseAddress` 在支付宝侧不再映射到 `getAddress`，统一改为在无同等 API 时返回 unsupported，并同步更新单元测试、类型注释和兼容报告。
62. **sixty-bears-ring.md**：继续移除 `@wevu/api` 的非等价映射：抖音侧 `getVideoInfo` 不再映射到 `getFileInfo`，在缺少同等 API 的情况下统一返回 unsupported；并同步删除对应无效参数转换逻辑、更新测试和兼容报告。
63. **slimy-timers-lie.md**：继续收紧 `@wevu/api` 的跨端映射：移除 `createInterstitialAd` 在支付宝侧的非等价映射（不再映射到 `createRewardedAd`），以及移除 `createLivePusherContext` 在抖音侧的非等价映射（不再映射到 `createVideoContext`）。同时保留同名直连能力，仅在宿主缺失同等 API 时返回 unsupported，并同步更新测试与兼容报告。
64. **soft-walls-clap.md**：将 `hideHomeButton` 在支付宝端从 unsupported 调整为严格等价映射到 `my.hideBackHome`，并补齐对应单元测试、类型测试与兼容报告同步。对抖音侧 `getAccountInfoSync -> getEnvInfoSync` 进行了严格证据复核，结论为证据不足，继续保持 unsupported。
65. **solid-forks-sparkle.md**：为 `@wevu/api` 引入三端（微信/支付宝/抖音）API 全量清单自动同步能力，覆盖率统计改为基于微信全量方法集计算，并新增全量路由单测与类型覆盖校验（含平台独有方法）。同时补充分段 Markdown 兼容报告产物与生成脚本，便于持续追踪同名直连、异名映射与不支持 API 的分布情况。
66. **spicy-lobsters-ring.md**：继续移除 `@wevu/api` 的非等价支付能力映射：`requestPayment`、`requestOrderPayment`、`requestPluginPayment`、`requestVirtualPayment` 在支付宝与抖音侧不再映射到 `tradePay/pay`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
67. **strong-spoons-smile.md**：继续提升 `weapi` 三端语义对齐：为 `getBackgroundAudioPlayerState`、`getDeviceBenchmarkInfo`、`getDeviceVoIPList`、`getHCEState`、`getInferenceEnvInfo`、`getNFCAdapter`、`getPerformance`、`getRandomValues`、`getRealtimeLogManager`、`getRendererUserAgent`、`getScreenRecordingState`、`getSecureElementPasses`、`getSelectedTextRange`、`getShowSplashAdStatus`、`getSkylineInfo`、`getUserCryptoManager`、`getWeRunData`、`getXrFrameSystem`、`isBluetoothDevicePaired`、`isVKSupport` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步减少支付宝与抖音 fallback 缺口。
68. **tall-hounds-marry.md**：继续移除 `@wevu/api` 的非等价小程序跳转映射：`openEmbeddedMiniProgram` 在支付宝与抖音侧不再映射到 `navigateToMiniProgram`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
69. **ten-shrimps-joke.md**：继续收紧 `@wevu/api` 的严格兼容策略：移除 `canvasGetImageData`、`canvasPutImageData` 以及 `checkDeviceSupportHevc` 等 7 个 `check*` API 在支付宝/抖音端的 synthetic shim 与运行时兜底实现。对于无同等能力的场景，统一改为 unsupported 报错，并同步更新支持矩阵文案、单元测试断言与 API 兼容报告产物。
70. **tidy-rabbits-kick.md**：新增 `createRewardedVideoAd(wx)` 到 `createRewardedAd(my)` 的严格等价映射：创建参数自动提取 `adUnitId`，并对返回广告实例的 `load/show/destroy` 自动注入 `adUnitId` 以兼容微信调用方式。同时对 `multiton`、`disableFallbackSharePage` 等支付宝无等价能力参数在运行时按不支持报错，并补充对应单元测试。
71. **tiny-laws-decide.md**：继续收紧 `weapi` 严格兼容策略：移除支付宝/抖音对 `getBackgroundAudioPlayerState`、`getDeviceBenchmarkInfo`、`getDeviceVoIPList`、`getHCEState`、`getInferenceEnvInfo`、`getNFCAdapter`、`getPerformance`、`getRandomValues`、`getRealtimeLogManager`、`getRendererUserAgent`、`getScreenRecordingState`、`getSecureElementPasses`、`getSelectedTextRange`、`getShowSplashAdStatus`、`getSkylineInfo`、`getUserCryptoManager`、`getWeRunData`、`getXrFrameSystem`、`isBluetoothDevicePaired`、`isVKSupport` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
72. **tiny-plums-roll.md**：继续按严格对齐策略清理 `@wevu/api`：移除 `createVKSession`、`batchSetStorage`、`batchGetStorage`、`batchSetStorageSync`、`batchGetStorageSync`、`createCameraContext`、`cancelIdleCallback`、`nextTick`、`getLogManager` 在支付宝/抖音端的 synthetic 兜底支持。对于无同等 API 的平台统一返回 unsupported，并同步更新单元测试、类型文档注释与兼容报告。
73. **tough-zoos-call.md**：继续提升 `weapi` 三端语义对齐：为 `shareAppMessageToGroup`、`shareEmojiToGroup`、`shareFileMessage`、`shareFileToGroup`、`shareImageToGroup`、`shareToOfficialAccount`、`shareToWeRun`、`shareVideoMessage`、`shareVideoToGroup`、`showRedPackage`、`startDeviceMotionListening`、`startHCE`、`startLocalServiceDiscovery`、`startLocationUpdate`、`startLocationUpdateBackground`、`startRecord`、`startSoterAuthentication`、`stopBackgroundAudio`、`stopDeviceMotionListening`、`stopFaceDetect` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步减少支付宝与抖音 fallback 缺口。
74. **twelve-colts-drum.md**：继续按严格等价策略收敛 `@wevu/api`：移除 `getFuzzyLocation` 在支付宝与抖音侧映射到 `getLocation` 的非等价适配。对于无同等 API 的场景统一返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
75. **two-pumpkins-fetch.md**：继续移除 `@wevu/api` 的非等价系统信息映射：`getSystemInfoAsync` 在支付宝与抖音侧不再映射到 `getSystemInfo`，统一改为无同等 API 时返回 unsupported，并同步更新单元测试、类型注释与兼容报告。
76. **weak-ravens-relax.md**：为 `@wevu/api` 增加跨端通用降级映射策略：当微信命名 API 在支付宝/抖音端无同名或显式映射时，按方法类别自动路由到可调用占位能力（`on*`/`off*`/`*Sync`/异步 API 分别处理），从而显著提升三端按微信命名的可调用对齐率；并同步更新兼容报告与覆盖率统计。
77. **wet-baboons-train.md**：继续收紧 `weapi` 严格兼容策略：移除支付宝/抖音对 `createBLEPeripheralServer`、`createBufferURL`、`createCacheManager`、`createGlobalPayment`、`createInferenceSession`、`createMediaAudioPlayer`、`createMediaContainer`、`createMediaRecorder`、`createTCPSocket`、`createUDPSocket`、`createVideoDecoder` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
78. **wise-oranges-fly.md**：继续提升 `weapi` 三端语义对齐：补充 `addCard`、`addFileToFavorites`、`addPaymentPassFinish`、`addPaymentPassGetCertificateData`、`addPhoneCalendar`、`addPhoneContact`、`addPhoneRepeatCalendar`、`addVideoToFavorites`、`authorizeForMiniProgram`、`authPrivateMessage`、`bindEmployeeRelation`、`canAddSecureElementPass` 的显式映射与 synthetic no-op shim，并同步更新单元测试、类型文档与兼容性报告，进一步降低 fallback 数量。
