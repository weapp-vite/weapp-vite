<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/cloud-server-sdk.html -->

# 云对云服务端

## 1. 运行环境要求

- x86\_64 运行环境
- glibc 2.28 或以上
- libcurl 7.84.0 或以上

## 2. 服务端消息接收与推送

对指定的 openid 发起呼叫后，若呼叫成功，微信开放平台会按照标准的 [消息推送](../../server-ability/message-push.md) 方法向开发者后台推送消息。 开发者按照 [消息推送](../../server-ability/message-push.md) 指引配置回调地址，消息加密方式必须选择「安全模式」。

需要注意的是，服务商角色可能需要服务多个小程序，可以使用 [第三方平台开发](https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/operation/thirdparty/config.html) 。

推送的消息大概如下：

```
{"ToUserName":"gh_27632a25xxx","Encrypt":"xxxx"}

// Encrypt 解密后的内容，参考字段说明。
```

开发者后台收到消息通知后，需要及时回复该请求，否则可能触发微信后台的重发，正确的回复格式如下：

```
{"errcode":0,"errmsg":"ok"}
```

errcode 为 0 代表回复成功，openid 所在的微信即响铃。若 errcode 为非 0 值，则微信侧不会响铃，此次通话取消。

字段说明：

<table><thead><tr><th>参数</th> <th>数据类型</th> <th>说明</th></tr></thead> <tbody><tr><td>Action</td> <td>String</td> <td>平台访问开发者后台的事件类型，本接口固定为join_voip_room</td></tr> <tr><td>RoomId</td> <td>String</td> <td>本次通话的房间id</td></tr> <tr><td>SessionKey</td> <td>String</td> <td>本次通话的 sessionkey</td></tr> <tr><td>ServerToken</td> <td>String</td> <td>本次通话的服务端凭证</td></tr> <tr><td>Payload</td> <td>String</td> <td>发起通话时第三方传入的自定义payload</td></tr> <tr><td>ModelId</td> <td>String</td> <td>Modelid</td></tr> <tr><td>Sn</td> <td>String</td> <td>Sn</td></tr></tbody></table>

内容示例：

```
{
"ToUserName":"gh_12345678",
"FromUserName":"openid",
"CreateTime":1709621375,
"MsgType":"event",
"Event":"iot_voip_notify",
"Action":"join_voip_room",
"Payload":"hello",
"RoomId":"wxf830863afde621ebWmpfVoip112343434123434",
"SessionKey":"COrwxeDmrJQuEOrwxeDmrJQuGhhrpMKQHttT1pG4eldlqIhi/L2qFpMQkn0iGCpUjLhxpYobRqjPK4DHWCHgRBi123412341234",
"ServerToken":"xyrOs/pwIHEZf3MFNjbhRHkL5XOmGDtW2nkor6EcmRLtHcoI6mP123412341234==",
"ModelId":"fJ4exxxxxxx",
"Sn":"1234"
}
```

## 3. 服务端 VOIP SDK

服务端 sdk 是 **单例模式** ，即 sdk 同时只能处理一个音视频通话. 由于开发者的服务端往往需要同时处理多个通话，因此云服务器后台接入服务端 sdk 时，需要每次有新请求时创建一个新进程，并在进程内调用服务端 sdk 接口完成本次的音视频通话.

通过消息推送得到此通呼叫的 server\_token 与 payload 后，即可使用 sdk 建立通话。

服务端 sdk 需要数据文件夹路径，调用 wx\_init 函数完成初始化工作（不需要小程序 appid 和 modelid）. 然后通过 join 接口加入 VoIP 房间，同时接收设备的音视频数据流，通过服务端 sdk 的相关接口填入数据或收到数据，即可完成设备与微信用户的音视频流通信。

## 4. 接口说明

具体接口如下，使用方法请参考 sdk 包中 example 目录下的 demo 代码。

wmpf.h

```
// Copyright (c) 2023, Tencent Inc.
// All rights reserved.
#pragma once

#include "wmpf/macros.h"
#include "wmpf/module.h"
#include "wmpf/operation.h"
#include "wmpf/types.h"

WX_BEGIN_DECLS

typedef enum wx_wxa_flavor {
  WX_WXA_FLAVOR_RELEASE = 0,  // 小程序正式版
  WX_WXA_FLAVOR_DEBUG = 1,    // 小程序开发版
  WX_WXA_FLAVOR_DEMO = 2,     // 小程序体验版
} wx_wxa_flavor_t;

#define WX_INIT_CONFIG_TAG 0x00001

/**
 * @brief WMPF 初始化结构体
 *
 * 强烈建议你在使用本结构体前 memset 置零, 避免遗忘某个项的设置.
 */
typedef struct wx_init_config {
  wx_struct_t common;

  /**
   * @brief WMPF 日志文件夹
   *
   * 用于存储 WMPF 日志文件.
   *
   * 若此项填 NULL, WMPF 将不输出日志.
   */
  const char* log_dir;

  /**
   * @brief WMPF 数据文件夹
   *
   * 用于存储 WMPF 数据文件.
   *
   * WMPF 数据文件夹内会保存和设备有关的重要的一次性的注册信息,
   * 无法在删除后恢复. 如果你需要清空设备数据，那么你需要备份 WMPF 的数据文件夹.
   */
  const char* data_dir;

  /**
   * @brief 产品 ID.
   *
   * 该项填 0.
   */
  int product_id;

  /**
   * @brief HostAppID
   *
   * 该项填 NULL.
   */
  const char* host_appid;

  /**
   * @brief 设备 ID (SN)
   *
   * 设备的唯一标识符 (唯一序列号), 该项需要由厂商定义.
   */
  const char* device_id;

  /**
   * @brief 设备签名
   *
   * 该项填 NULL.
   */
  const char* device_signature;

  /**
   * @brief 设备签名版本
   *
   * 该项填 0.
   */
  int device_signature_version;

  /**
   * @brief Model ID
   *
   * Model ID 是调用小程序设备相关接口的重要凭证.
   * 在设备接入时从【小程序管理后台】申请获得的 Model ID.
   *
   * @see
   * https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-access.html
   * https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-message.html
   */
  const char* model_id;

  /**
   * @brief 小程序 AppID
   *
   * 小程序 AppID 是小程序的唯一标识符, 在 VoIP 场景下此项必填.
   * 在 VoIP 发起通话后, 被拨打的微信用户手机将拉起这里被指定的小程序用于通话.
   */
  const char* wxa_appid;

  /**
   * @brief 小程序版本
   *
   * 对于 VoIP 场景: 要在小程序正式版运行微信 VoIP,
   * 需要先提交设备给微信审核通过后才能获得相关权限. 因此在接入调试期间,
   * 你需要使用小程序开发版/体验版测试 VoIP 功能的可用性.
   *
   * 要设置为开发版还是体验版, 请向你的小程序开发同事咨询.
   *
   * 注意, 如果设备开发同事需要使用小程序开发版测试 VoIP 功能,
   * 设备开发同事必须先获得小程序开发者权限,
   * 并及时扫描小程序开发同事的微信开发者工具的真机调试二维码,
   * 提前在本地微信客户端打开一次开发版小程序, 否则微信客户端在收到 VoIP
   * 通话强提醒时, 会缺少小程序开发版代码包, 导致小程序启动失败.
   */
  wx_wxa_flavor_t wxa_flavor;

  /**
   * @brief RPMB 设备路径
   *
   * 如果设备有 RPMB 且 Key 处于可写状态时, 应当采用 RPMB 方式初始化 SDK.
   * 并传入 RPMB 设备路径 (一般为 /dev/mmXXXXX)
   */
  const char* rpmb_device;

  /**
   * @brief 是否仅仅支持 H265
   *
   * 如果设备只支持 H265，可以设置此字段为 true.
   *
   * 如果不设置，微信 voip 后台会自适应，开发者也可以发送 H265 流，但无法决定手机端过来的是什么类型流.
   * 如果设置 true，则发送和接收都为 H265。
   */
  bool h265_only;

  /**
   * @brief SDK 接收小程序推流是否为 4:3 的流。
   *
   * true:  SDK 收到流的宽高比 4:3 --- 320x240 480x352 640x480 1280x720 1920x1080
   * false: SDK 收到流的宽高比 3:4 --- 240x320 352x480 480x640 720x1080 1080x1920
   */
  bool video_landscape;

  /**
   * @brief 订阅 SDK 期望收到的分辨率
   *
   * 开发者可以用此配置来订阅一个分辨率的长边值。
   * 此功能主要是针对那些不希望收到可变分辨率视频流的设备，如果不使用此功能，SDK 收到的视频流在不同的网络环境下会有不同的分辨率。
   * 此功能需要同时向微信提交 appid，待开通订阅机制后才生效。
   * 目前这个配置仅支持如下两个值：
   *   320: video_landscape = true 时收到的是 320x240，video_landscape = fale 时收到的是 240x320
   *   640: 不支持 video_landscape = true 模式，video_landscape = fale 时收到的是 480x640
   */
  int subscribe_video_length;

  /**
   * @brief 订阅 SDK 期望收到的流方向
   *
   * 开发者可以用此配置来订阅自己收到的流的方向
   * SDK 默认收到的是逆时针旋转了 90 度的视频流，如果开发者的硬件没有旋转渲染能力，可以使用这个订阅。订阅 0 度流后，对端的微信客户端会对流进行前处理再发出。
   * 此功能 Beta 中，需要微信客户端与插件均支持方可生效.
   * 目前这个配置仅支持如下两个值：
   *   1:   0 度流, 需要配合小程序端的 0 度流参数，两者一致后才能收到 0 度流。
   *   其它：旋转流，默认也是旋转流。
   */
  int subscribe_video_rotation;

  /**
   * @brief 订阅 SDK 期望收到的流比例
   *
   * 开发者可以用此配置来订阅自己收到的流的比例
   * 此功能 Beta 中，需要微信客户端与插件均支持方可生效.
   * 定义如下：
   *   75:   宽/高 * 100 = 75, 例如 240x320
   *   133: 宽/高 * 100 = 133, 例如 320x240
   *   50: 宽/高 * 100 = 50, 例如 160x320
   *   200: 宽/高 * 100 = 200, 例如 320x160
   *   ...
   */
  int subscribe_video_ratio;

  /**
   * @brief 订阅 SDK 期望收到流的最大 fps
   *
   * 开发者可以用此配置来订阅自己收到流的最大 fps
   * SDK 默认收到的 fps 最大会涨至 15，通过这个值，可以限定 fps 的最大值。
   * 此功能 Beta 中，需要微信客户端与插件均支持方可生效.
   * 目前这个配置支持如下值：
   *   5 ~ 15:
   */
  int subscribe_video_maxfps;
} wx_init_config_t;

/**
 * @brief 初始化 WMPF
 *
 * 在执行任意 WMPF 调用之前需要调用 wx_init() 初始化 WMPF.
 * 函数提供设备的基础信息、启动并运行 WMPF.
 *
 * 该函数是异步函数, 会产生网络请求, 请确保在调用本函数时网络通畅.
 *
 * @param config (nonnull) 初始化参数, 包含设备的初始信息
 * @param get_module (nonnull) WMPF 获取厂商提供的接口的回调函数, 实现方法参见
 * wx_get_module_t 的文档
 * @return 运行是否成功
 *   - WXERROR_INVALID_ARGUMENT: 输入参数不合法，或者产品 ID、设备
 * ID、设备签名不匹配
 *   - WXERROR_TIMEOUT: 超时
 *   - WXERROR_RESOURCE_EXHAUSTED: 网络未联通或者本地磁盘写入失败
 *   - WXERROR_FAILED_PRECONDITION: 设备未通过 adddevice 注册, 或者 wx_init
 * 已被调用过了, 或者当前系统时间不正确.
 *   - WXERROR_INTERNAL: 其他错误
 */
WX_API wx_operation_t wx_init(const wx_init_config_t* config,
                              wx_get_module_t get_module);

/**
 * @brief 停止 WMPF
 *
 * 调用该函数之前, 你需要确保创建的 wx_operation, wx_voip_session 等对象都已经被
 * destroy, 否则 SDK 会崩溃.
 *
 * @return 操作是否成功
 */
WX_API wx_error_t wx_stop();

WX_END_DECLS
```

cloudvoip\_server.h

```
#pragma once

#include "wmpf/macros.h"
#include "wmpf/operation.h"
#include "wmpf/types.h"

WX_BEGIN_DECLS

typedef struct wx_cloudvoip_session* wx_cloudvoip_session_t;

typedef enum wx_cloudvoip_session_type {
  WX_CLOUDVOIP_SESSION_VIDEO = 0,  // 音视频通话
  WX_CLOUDVOIP_SESSION_AUDIO = 1,  // 纯音频通话
} wx_cloudvoip_session_type_t;

typedef enum wx_cloudvoip_session_status {
  WX_CLOUDVOIP_SESSION_IDLE = 0,     // 初始状态
  WX_CLOUDVOIP_SESSION_CALLING = 1,  // 拨打电话中
  WX_CLOUDVOIP_SESSION_TALKING = 2,  // 通话中 (被拨打的微信用户接听了电话)
  WX_CLOUDVOIP_SESSION_REJECTED = 3,  // 被拨打的微信用户拒绝接听电话
  WX_CLOUDVOIP_SESSION_CANCELED = 4,  // 拨打过程中, 设备取消了电话拨打
  WX_CLOUDVOIP_SESSION_HANGUP_BY_CALLER = 5,  // 通话时设备挂断了电话
  WX_CLOUDVOIP_SESSION_HANGUP_BY_CALLEE =
      6,  // 通话时被拨打的微信用户挂断了电话
  WX_CLOUDVOIP_SESSION_ABORTED = 7,  // 发生异常
  WX_CLOUDVOIP_SESSION_BUSY = 8,  // 被拨打的微信用户处于占线状态
  WX_CLOUDVOIP_SESSION_TIMEOUT = 9,  // 超时未接听
} wx_cloudvoip_session_status_t;

typedef enum wx_cloudvoip_hangup_reason {
  WX_CLOUDVOIP_HANGUP_REASON_UNKNOWN = 0,
  WX_CLOUDVOIP_HANGUP_REASON_MANUAL = 1,  // 用户手动挂断/取消

  // 主叫挂断原因
  WX_CLOUDVOIP_HANGUP_REASON_SYSTEM = 6,  // 被系统电话挂断
  WX_CLOUDVOIP_HANGUP_REASON_APP = 7,     // 被其他应用挂断
  WX_CLOUDVOIP_HANGUP_REASON_DEVICE = 8,  // 采集播放设备启动失败

  WX_CLOUDVOIP_HANGUP_REASON_TIMEOUT = 10, // 超时挂断
  WX_CLOUDVOIP_HANGUP_REASON_REJECT = 11, // 拒绝通话，指的是没有进入通话即挂断
} wx_cloudvoip_hangup_reason_t;

#define WX_CLOUDVOIP_SESSION_LISTENER_TAG 0xF00001

typedef struct wx_cloudvoip_session_listener {
  wx_struct_t common;

  /**
   * @brief 当前 VoIP 通话状态改变
   *
   */
  void (*status)(wx_cloudvoip_session_t session,
                 void* user_data,
                 wx_cloudvoip_session_status_t);

} wx_cloudvoip_session_listener_t;

/**
 * @brief 服务端侧加入 VoIP 房间并创建 VoIP 会话对象
 *
 * 需要注意：
 * 此接口用于设备端 SDK 发起的通话加入。
 * 服务端 SDK 是单例模式的，你不能在单进程内同时创建两个或以上的
 * wx_cloudvoip_session 实例. 因此你需要使用多进程模式来调用服务端 SDK.
 * 因此此处可能还涉及 IPC 需要厂商云自行实现.
 *
 * 发起 VoIP 通话流程：
 * 1. 设备端 SDK 调用 call 方法发起通话
 * 2. 微信后台请求厂商云后台，通知云后台有新的 VoIP 会话已经发起
 * 3. 云后台调用服务端 SDK 的 wx_cloudvoip_session_join 方法加入 VoIP 会话
 * 4. 云后台通过 audio_module, camera_module 传输音视频流给服务端 SDK
 * 5. 服务端 SDK 将接收到的音视频流发送给微信后台，继而发送到用户手机微信中
 *
 * @param listener 会话状态回调
 * @param user_data 回调用户数据
 * @param wxa_appid 小程序 AppId
 * @param device_id 设备 SN
 * @param model_id Model ID
 * @param server_token 微信后台向云后台通知 VoIP 会话发起时携带的值
 * @param payload 设备端调用 wx_cloudvoip_client_call 函数传入的 payload
 * @param session_out VoIP 会话结果
 * @return
 *   - WXERROR_INVALID_ARGUMENT: 参数错误
 *   - WXERROR_FAILED_PRECONDITION: wx_init 未调用或未完成.
 */
WX_API wx_operation_t
wx_cloudvoip_session_join(wx_cloudvoip_session_type_t,
                          const struct wx_cloudvoip_session_listener* listener,
                          void* user_data,
                          const char* wxa_appid,
                          const char* device_id,
                          const char* model_id,
                          const char* server_token,
                          const char* payload,
                          wx_cloudvoip_session_t* session_out);

/**
 * @brief 呼叫成功后挂断 VoIP 通话
 *
 * 由于设备端 SDK 不提供挂断方法，云对云场景下，由厂商云后台调用服务端 SDK
 * 的挂断函数挂断 VoIP 通话.
 *
 * @param session 要挂断的 VoIP 会话
 * @param reason 挂断 VoIP 通话的原因
 * @return 操作是否成功
 */
WX_API wx_operation_t
wx_cloudvoip_session_hangup(wx_cloudvoip_session_t session,
                            wx_cloudvoip_hangup_reason_t reason);

/**
 * @brief 作为接听方(小程序呼叫设备)挂断 VoIP, 如果是设备呼叫小程序，则不建议使用此接口。
 *
 * 小程序呼设备的场景，设备端挂断 voip 接口，如果 session 已创建，则需要使用 wx_cloudvoip_session_hangup 挂断
 *
 * @param wxa_appid 小程序 AppId
 * @param device_id 设备 SN
 * @param model_id Model ID
 * @param server_token 微信后台向云后台通知 VoIP 会话发起时携带的值
 * @param payload 设备端调用 wx_cloudvoip_client_join 函数传入的 payload
 * @return 操作是否成功
 */
WX_API wx_operation_t wx_cloudvoip_listener_hangup(
    const char* wxa_appid,
    const char* device_id,
    const char* model_id,
    const char* server_token,
    const char* payload,
    wx_cloudvoip_hangup_reason_t reason);

/**
 * @brief 销毁 VoIP 会话对象
 *
 * @param session
 * @return WX_API
 */
WX_API void wx_cloudvoip_session_destroy(wx_cloudvoip_session_t session);

/**
 * @brief 得到当前 session 的 roomid
 *
 *  roomid: voip 通话所在房间的标识。
 *
 * @param session
 * @return roomid 字符串 或 "".
 */
WX_API const char* wx_cloudvoip_session_get_roomid(wx_cloudvoip_session_t session);

/**
 * @brief 设置对端（微信）的带宽以强制流控，设置后对端的上行码率会在这个值上下波动
 *
 * @param session
 * @param bandwidth 码率，单位为 kbps. 比如 100，则码率为 100 kbps
 * @return
 *  WXERROR_OK: 操作成功
 *  WXERROR_FAILED_PRECONDITION: session 不满足条件
 *  WXERROR_INTERNAL: 内部错误
 */
WX_API wx_error_t wx_cloudvoip_session_set_remote_bandwidth(wx_cloudvoip_session_t session, int bandwidth);

/**
 * @brief 服务端侧加入 VoIP 房间并创建 VoIP 会话对象
 *
 * 需要注意：
 * 此接口用于服务端请求 https://api.weixin.qq.com/wxa/business/iot/voip/call 发起的通话加入
 * 服务端 SDK 是单例模式的，你不能在单进程内同时创建两个或以上的
 * wx_cloudvoip_session 实例. 因此你需要使用多进程模式来调用服务端 SDK.
 * 因此此处可能还涉及 IPC 需要厂商云自行实现.
 *
 * 发起 VoIP 通话流程：
 * 1. 服务端请求 https://api.weixin.qq.com/wxa/business/iot/voip/call 发起通话
 * 2. 微信后台请求厂商云后台，通知云后台有新的 VoIP 会话已经发起
 * 3. 云后台调用服务端 SDK 的 wx_cloudvoip_session_cloud_call_join 方法加入 VoIP 会话
 * 4. 云后台通过 audio_module, camera_module 传输音视频流给服务端 SDK
 * 5. 服务端 SDK 将接收到的音视频流发送给微信后台，继而发送到用户手机微信中
 *
 * @param listener 会话状态回调
 * @param user_data 回调用户数据
 * @param wxa_appid 小程序 AppId
 * @param server_token 微信后台向云后台通知 VoIP 会话发起时携带的值
 * @param roomid 房间id
 * @param session_key 房间session_key
 * @param payload 设备端调用 wx_cloudvoip_client_call 函数传入的 payload
 * @param session_out VoIP 会话结果
 * @return
 *   - WXERROR_INVALID_ARGUMENT: 参数错误
 *   - WXERROR_FAILED_PRECONDITION: wx_init 未调用或未完成.
 */
WX_API wx_operation_t
wx_cloudvoip_session_cloud_call_join(wx_cloudvoip_session_type_t,
                          const struct wx_cloudvoip_session_listener* listener,
                          void* user_data,
                          const char* wxa_appid,
                          const char* server_token,
                          const char* roomid,
                          const char* session_key,
                          const char* payload,
                          wx_cloudvoip_session_t* session_out);

WX_END_DECLS
```
