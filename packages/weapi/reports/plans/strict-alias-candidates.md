# strict alias 候选复筛（自动生成）

- 阈值：`0.75`
- 输出规则：仅保留 `unsupported` 且“名称相似度 >= 阈值”的最佳候选。
- 注意：本清单仅用于复核线索，不代表可直接建立映射；仍需声明级与语义级证据。

## 支付宝候选（my）

共 16 项。

| 微信 API                          | my 候选 API               | 相似度 |
| --------------------------------- | ------------------------- | -----: |
| `batchGetStorageSync`             | `getStorageInfoSync`      |   0.75 |
| `batchSetStorageSync`             | `setStorageSync`          |   0.75 |
| `createAudioContext`              | `createInnerAudioContext` |   0.75 |
| `createWebAudioContext`           | `createInnerAudioContext` |   0.75 |
| `getBackgroundFetchToken`         | `getBackgroundFetchData`  |   0.75 |
| `getExptInfoSync`                 | `getAccountInfoSync`      |   0.75 |
| `getSkylineInfoSync`              | `getAccountInfoSync`      |   0.75 |
| `getUserInfo`                     | `getOpenUserInfo`         |   0.75 |
| `getWeRunData`                    | `getRunData`              |   0.75 |
| `offNetworkWeakChange`            | `offNetworkStatusChange`  |   0.75 |
| `onBackgroundFetchData`           | `getBackgroundFetchData`  |   0.75 |
| `onNetworkWeakChange`             | `onNetworkStatusChange`   |   0.75 |
| `openAppAuthorizeSetting`         | `getAppAuthorizeSetting`  |   0.75 |
| `requestSubscribeDeviceMessage`   | `requestSubscribeMessage` |   0.75 |
| `requestSubscribeEmployeeMessage` | `requestSubscribeMessage` |   0.75 |
| `showShareImageMenu`              | `showShareMenu`           |   0.75 |

## 抖音候选（tt）

共 19 项。

| 微信 API                          | tt 候选 API               | 相似度 |
| --------------------------------- | ------------------------- | -----: |
| `saveVideoToPhotosAlbum`          | `saveImageToPhotosAlbum`  |   0.80 |
| `batchGetStorageSync`             | `getStorageInfoSync`      |   0.75 |
| `batchSetStorageSync`             | `setStorageSync`          |   0.75 |
| `createAudioContext`              | `createInnerAudioContext` |   0.75 |
| `createLivePusherContext`         | `createLivePlayerContext` |   0.75 |
| `createWebAudioContext`           | `createInnerAudioContext` |   0.75 |
| `getAccountInfoSync`              | `getEnvInfoSync`          |   0.75 |
| `getBatteryInfoSync`              | `getEnvInfoSync`          |   0.75 |
| `getChannelsLiveInfo`             | `getLiveUserInfo`         |   0.75 |
| `getEnterOptionsSync`             | `getLaunchOptionsSync`    |   0.75 |
| `getExptInfoSync`                 | `getEnvInfoSync`          |   0.75 |
| `getInferenceEnvInfo`             | `getEnvInfoSync`          |   0.75 |
| `getSkylineInfoSync`              | `getEnvInfoSync`          |   0.75 |
| `offNetworkWeakChange`            | `offNetworkStatusChange`  |   0.75 |
| `onNetworkWeakChange`             | `onNetworkStatusChange`   |   0.75 |
| `openChannelsUserProfile`         | `openAwemeUserProfile`    |   0.75 |
| `requestSubscribeDeviceMessage`   | `requestSubscribeMessage` |   0.75 |
| `requestSubscribeEmployeeMessage` | `requestSubscribeMessage` |   0.75 |
| `showShareImageMenu`              | `showShareMenu`           |   0.75 |
