// 本文件由 components.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_MEDIA_CAPTURE_LIVE = [
  {
    "name": "camera",
    "description": "系统相机。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n用户不允许使用摄像头时触发"
      },
      {
        "name": "bindscancode",
        "description": "Type: function => any\n在成功识别到一维码时触发，仅在 mode=\"scanCode\" 时生效\nSince: 2.1.0"
      },
      {
        "name": "bindstop",
        "description": "Type: function => any\n摄像头在非正常终止时触发，如退出后台等情况"
      },
      {
        "name": "device-position",
        "description": "Type: string\n前置或后置，值为front, back\nDefault: back"
      },
      {
        "name": "flash",
        "description": "Type: string\n闪光灯，值为auto, on, off\nDefault: auto"
      },
      {
        "name": "mode",
        "description": "Type: string\n有效值为 normal, scanCode\nDefault: normal\nSince: 2.1.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/camera.html"
      }
    ]
  },
  {
    "name": "canvas",
    "description": "画布。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n当发生错误时触发 error 事件，detail = {errMsg: 'something wrong'}"
      },
      {
        "name": "bindlongtap",
        "description": "Type: function => any\n手指长按 500ms 之后触发，触发了长按事件后进行移动不会触发屏幕的滚动"
      },
      {
        "name": "bindtouchcancel",
        "description": "Type: function => any\n手指触摸动作被打断，如来电提醒，弹窗"
      },
      {
        "name": "bindtouchend",
        "description": "Type: function => any\n手指触摸动作结束"
      },
      {
        "name": "bindtouchmove",
        "description": "Type: function => any\n手指触摸后移动"
      },
      {
        "name": "bindtouchstart",
        "description": "Type: function => any\n手指触摸动作开始"
      },
      {
        "name": "canvas-id",
        "description": "Type: string\ncanvas 组件的唯一标识符"
      },
      {
        "name": "disable-scroll",
        "description": "Type: boolean\n当在 canvas 中移动时且有绑定手势事件时，禁止屏幕滚动以及下拉刷新\nDefault: false"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html"
      }
    ]
  },
  {
    "name": "live-player",
    "description": "实时音视频播放。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。\n\n暂只针对国内主体如下类目的小程序开放，需要先通过类目审核，再在小程序管理后台，“设置”-“接口设置”中自助开通该组件权限。\n\n{社交 => \"直播\"; 教育 => \"在线教育\"; 医疗 => \"互联网医院，公立医院\"; 政务民生 => \"所有二级类目\"; 金融 =\\> \"基金、信托、保险、银行、证券/期货、非金融机构自营小额贷款、征信业务、消费金融\"}",
    "attributes": [
      {
        "name": "autoplay",
        "description": "Type: boolean\n自动播放\nDefault: false"
      },
      {
        "name": "background-mute",
        "description": "Type: boolean\n进入后台时是否静音（已废弃，默认退台静音）\nDefault: false"
      },
      {
        "name": "bindfullscreenchange",
        "description": "Type: function => any\n全屏变化事件，detail = {direction, fullScreen}"
      },
      {
        "name": "bindnetstatus",
        "description": "Type: function => any\n网络状态通知，detail = {info}\ninfo: {videoBitrate => \"当前视频编/码器输出的比特率，单位 kbps\"; audioBitrate => \"当前音频编/码器输出的比特率，单位 kbps\"; videoFPS => \"当前视频帧率\"; videoGOP => \"当前视频 GOP,也就是每两个关键帧(I帧)间隔时长，单位 s\"; netSpeed => \"当前的发送/接收速度\"; netJitter => \"网络抖动情况，抖动越大，网络越不稳定\"; videoWidth => \"视频画面的宽度\"; videoHeight => \"视频画面的高度\"}\nSince: 1.9.0"
      },
      {
        "name": "bindstatechange",
        "description": "Type: function => any\n播放状态变化事件，detail = {code}\ncode: {2001 => \"已经连接服务器\"; 2002 => \"已经连接服务器,开始拉流\"; 2003 => \"网络接收到首个视频数据包(IDR)\"; 2004 => \"视频播放开始\"; 2005 => \"视频播放进度\"; 2006 => \"视频播放结束\"; 2007 => \"视频播放Loading\"; 2008 => \"解码器启动\"; 2009 => \"视频分辨率改变\"; -2301 => \"网络断连，且经多次重连抢救无效，更多重试请自行重启播放\"; -2302 => \"获取加速拉流地址失败\"; 2101 => \"当前视频帧解码失败\"; 2102 => \"当前音频帧解码失败\"; 2103 => \"网络断连, 已启动自动重连\"; 2104 => \"网络来包不稳：可能是下行带宽不足，或由于主播端出流不均匀\"; 2105 => \"当前视频播放出现卡顿\"; 2106 => \"硬解启动失败，采用软解\"; 2107 => \"当前视频帧不连续，可能丢帧\"; 2108 => \"当前流硬解第一个I帧失败，SDK自动切软解\"; 3001 => \"RTMP -DNS解析失败\"; 3002 => \"RTMP服务器连接失败\"; 3003 => \"RTMP服务器握手失败\"; 3005 => \"RTMP 读/写失败\"}"
      },
      {
        "name": "max-cache",
        "description": "Type: number\n最大缓冲区，单位s\nDefault: 3"
      },
      {
        "name": "min-cache",
        "description": "Type: number\n最小缓冲区，单位s\nDefault: 1"
      },
      {
        "name": "mode",
        "description": "Type: string\nlive（直播），RTC（实时通话）\nDefault: live"
      },
      {
        "name": "muted",
        "description": "Type: boolean\n是否静音\nDefault: false"
      },
      {
        "name": "object-fit",
        "description": "Type: string\n填充模式，可选值有 contain，fillCrop\nDefault: contain"
      },
      {
        "name": "orientation",
        "description": "Type: string\n画面方向，可选值有 vertical，horizontal\nDefault: vertical"
      },
      {
        "name": "src",
        "description": "Type: string\n音视频地址。目前仅支持 flv, rtmp 格式"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html"
      }
    ]
  },
  {
    "name": "live-pusher",
    "description": "实时音视频录制。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。\n\n暂只针对国内主体如下类目的小程序开放，需要先通过类目审核，再在小程序管理后台，“设置”-“接口设置”中自助开通该组件权限。\n\n{社交 => \"直播\"; 教育 => \"在线教育\"; 医疗 => \"互联网医院，公立医院\"; 政务民生 => \"所有二级类目\"; 金融 =\\> \"基金、信托、保险、银行、证券/期货、非金融机构自营小额贷款、征信业务、消费金融\"}",
    "attributes": [
      {
        "name": "aspect",
        "description": "Type: string\n宽高比，可选值有 3:4, 9:16\nDefault: 9:16"
      },
      {
        "name": "auto-focus",
        "description": "Type: boolean\n自动聚集\nDefault: true"
      },
      {
        "name": "autopush",
        "description": "Type: boolean\n自动推流\nDefault: false"
      },
      {
        "name": "background-mute",
        "description": "Type: boolean\n进入后台时是否静音\nDefault: false"
      },
      {
        "name": "beauty",
        "description": "Type: number\n美颜\nDefault: 0"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n渲染错误事件，detail = {errMsg, errCode}\nerrCode: {10001 => \"用户禁止使用摄像头\"; 10002 => \"用户禁止使用录音\"}\nSince: 1.7.4"
      },
      {
        "name": "bindnetstatus",
        "description": "Type: function => any\n网络状态通知，detail = {info}\ninfo: {videoBitrate => \"当前视频编/码器输出的比特率，单位 kbps\"; audioBitrate => \"当前音频编/码器输出的比特率，单位 kbps\"; videoFPS => \"当前视频帧率\"; videoGOP => \"当前视频 GOP,也就是每两个关键帧(I帧)间隔时长，单位 s\"; netSpeed => \"当前的发送/接收速度\"; netJitter => \"网络抖动情况，抖动越大，网络越不稳定\"; videoWidth => \"视频画面的宽度\"; videoHeight => \"视频画面的高度\"}\nSince: 1.9.0"
      },
      {
        "name": "bindstatechange",
        "description": "Type: function => any\n状态变化事件，detail = {code}\ncode: {1001 => \"已经连接推流服务器\"; 1002 => \"已经与服务器握手完毕,开始推流\"; 1003 => \"打开摄像头成功\"; 1004 => \"录屏启动成功\"; 1005 => \"推流动态调整分辨率\"; 1006 => \"推流动态调整码率\"; 1007 => \"首帧画面采集完成\"; 1008 => \"编码器启动\"; -1301 => \"打开摄像头失败\"; -1302 => \"打开麦克风失败\"; -1303 => \"视频编码失败\"; -1304 => \"音频编码失败\"; -1305 => \"不支持的视频分辨率\"; -1306 => \"不支持的音频采样率\"; -1307 => \"网络断连，且经多次重连抢救无效，更多重试请自行重启推流\"; -1308 => \"开始录屏失败，可能是被用户拒绝\"; -1309 => \"录屏失败，不支持的Android系统版本，需要5.0以上的系统\"; -1310 => \"录屏被其他应用打断了\"; -1311 => \"Android Mic打开成功，但是录不到音频数据\"; -1312 => \"录屏动态切横竖屏失败\"; 1101 => \"网络状况不佳：上行带宽太小，上传数据受阻\"; 1102 => \"网络断连, 已启动自动重连\"; 1103 => \"硬编码启动失败,采用软编码\"; 1104 => \"视频编码失败\"; 1105 => \"新美颜软编码启动失败，采用老的软编码\"; 1106 => \"新美颜软编码启动失败，采用老的软编码\"; 3001 => \"RTMP -DNS解析失败\"; 3002 => \"RTMP服务器连接失败\"; 3003 => \"RTMP服务器握手失败\"; 3004 => \"RTMP服务器主动断开，请检查推流地址的合法性或防盗链有效期\"; 3005 => \"RTMP 读/写失败\"}"
      },
      {
        "name": "device-position",
        "description": "Type: string\n前置或后置，值为front, back\nDefault: front\nSince: 2.3.0"
      },
      {
        "name": "enable-camera",
        "description": "Type: boolean\n开启摄像头\nDefault: true"
      },
      {
        "name": "max-bitrate",
        "description": "Type: number\n最大码率\nDefault: 1000"
      },
      {
        "name": "min-bitrate",
        "description": "Type: number\n最小码率\nDefault: 200"
      },
      {
        "name": "mode",
        "description": "Type: string\nSD（标清）, HD（高清）, FHD（超清）, RTC（实时通话）\nDefault: RTC"
      },
      {
        "name": "muted",
        "description": "Type: boolean\n是否静音\nDefault: false"
      },
      {
        "name": "orientation",
        "description": "Type: string\nvertical，horizontal\nDefault: vertical"
      },
      {
        "name": "url",
        "description": "Type: string\n推流地址。目前仅支持 flv, rtmp 格式"
      },
      {
        "name": "waiting-image",
        "description": "Type: string\n进入后台时推流的等待画面"
      },
      {
        "name": "waiting-image-hash",
        "description": "Type: string\n等待画面资源的MD5值"
      },
      {
        "name": "whiteness",
        "description": "Type: number\n美白\nDefault: 0"
      },
      {
        "name": "zoom",
        "description": "Type: boolean\n调整焦距\nDefault: false\nSince: 2.1.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html"
      }
    ]
  },
  {
    "name": "voip-room",
    "description": "多人音视频对话。\n暂只针对国内主体[如下类目](https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html)的小程序开放，需要先通过类目审核，再在小程序管理后台，「开发」-「接口设置」中自助开通该组件权限。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: eventhandle\n创建对话窗口失败时触发"
      },
      {
        "name": "device-position",
        "description": "Type: string\n仅在 mode 为 camera 时有效，前置或后置，值为`front`,`back`\nDefault: front",
        "values": [
          {
            "name": "front",
            "description": "前置"
          },
          {
            "name": "back",
            "description": "后置"
          }
        ]
      },
      {
        "name": "mode",
        "description": "Type: string\n对话窗口类型，自身传入 camera，其它用户传入 video\nDefault: camera"
      },
      {
        "name": "openid",
        "description": "Type: string\n进入房间用户的 openid"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html"
      }
    ]
  }
]
