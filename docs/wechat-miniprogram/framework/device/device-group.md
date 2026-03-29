<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-group.html -->

# 设备组

针对某些需要对设备进行批量操作的场景，可以通过设备组完成。

## 1. 设备组的限制

- 一个设备组默认最多添加 **50 个设备** ，一个设备只能属于一个设备组。
- 符合大容量设备组使用条件的，可以使用扩容组。
- 同一个设备组内的设备必须属于同一设备类型(model\_type)，例如「校园电话」，但不一定是相同设备型号(model\_id)。
- 设备组必须通过后台 API 创建，创建后 **不允许修改设备组的名称** 。用户授权和接听通话时看到的都是设备组的名称，而不能针对用户自定义。

## 2. 管理设备组

开发者可以通过下列后台接口完成对设备组的增删改查操作。

**开发者需要维护创建的所有设备组的 group\_id，已便后续查询和授权时使用。微信只做校验，不维护小程序下创建的所有 group\_id 列表。**

- [创建设备组](https://developers.weixin.qq.com/miniprogram/dev/framework/device/(createIotGroupId))
- [扩容设备组](https://developers.weixin.qq.com/miniprogram/dev/framework/device/(expandGroup))
- [从设备组删除设备](https://developers.weixin.qq.com/miniprogram/dev/framework/device/(removeIotGroupDevice))
- [向设备组添加设备](https://developers.weixin.qq.com/miniprogram/dev/framework/device/(addIotGroupDevice))
- [查询设备组信息](https://developers.weixin.qq.com/miniprogram/dev/framework/device/(getIotGroupInfo))

**注意：**

除了设备组创建时添加设备外，一般添加或删除设备只应发生在添购设备、设备损坏更换、设备裁撤等场景。请开发者保持设备组内设备的相对稳定，避免过于频繁的修改设备组的组成。

**微信会对设备组操作进行监测，并在必要时要求小程序管理员进行手动确认。这种情况下，设备组操作会在管理员确认后生效。**

## 3. 适用场景

目前可用于 [设备批量授权](./voip/auth.md) 的场景。

## 4. 问题排查指引

### 4.1 为什么设备之前添加过设备组了，但是设备组里查不到？

- 可能由其他逻辑调用了 `removeIotGroupDevice` 从设备组中将设备删除；
- 可能由其他地方使用 `addIotGroupDevice` (force\_add=true) 强制将设备转移到了其他设备组，也会导致设备从之前的组里移除。

### 4.2 用户授权设备组后，仍提示未授权设备(errCode = 9)如何排查？

使用设备组的设备，如果提示未授权，可能有以下几种可能

- 用户未授权设备组，或曾经授权后用户 [清空或取消授权](./voip/auth.md#_2-%E5%A4%84%E7%90%86%E6%8E%88%E6%9D%83%E5%A4%B1%E6%95%88%E7%9A%84%E6%83%85%E5%86%B5)
    - 可以使用 [授权状态查询](./voip/auth.md#_4-%E6%8E%88%E6%9D%83%E7%8A%B6%E6%80%81%E6%9F%A5%E8%AF%A2%E6%8E%A5%E5%8F%A3) 接口，判断用户和设备/设备组直接是否存在授权关系
- 用户授权了设备组，但是设备组内无此设备。
    - 可以使用 [getIotGroupInfo](https://developers.weixin.qq.com/miniprogram/dev/framework/device/(getIotGroupInfo)) 查询设备组中的设备列表。

### 4.3 A、B 两名用户都授权了设备组 X，但是 A 能打通设备组内的设备 X1，B 却不行？

一般是由于用户 A 和设备之间其实已存在直接授权（未通过设备组）。假设设备 X1 存在于设备组 X 中。

- 用户 A 同时授权设备组 X 和直接授权设备 X1。此时即使设备 X1 被移除出设备组 X，用户 A 仍能拨打给设备。
- 用户 B 仅授权设备组 X。此时设备 X1 被移除设备组 X 后，用户 B 无法打给设备。
