package com.dsharnessmobile.shell

/**
 * 内置浏览器的隔离档位（旧 WebView 兼容架构线，spike 记录见
 * docs/BROWSER-COMPAT-SPIKE-2026-10-24.md）。
 *
 * 档位语义：
 *  - [PROFILE_API]    androidx WebView Profile（MULTI_PROFILE，要求 WebView 提供方 114+），
 *                     会话级隔离（每会话独立浏览器档案）；
 *  - [PROCESS_SUFFIX] 独立 :browser 进程 + setDataDirectorySuffix + SurfaceControlViewHost
 *                     投影（API 29+），全 app 共享一个浏览器档案，但与引擎 cookie/存储
 *                     完全隔离（不同进程 + 不同数据目录）；
 *  - [UNAVAILABLE]    无隔离手段可用，fail-closed（绝不降级共享 Default 档案）。
 *
 * 档位优先级：PROFILE_API 优先；PROCESS_SUFFIX 仅在 MULTI_PROFILE 缺位且兼容渲染器
 * 就绪时兜底。本模型先于渲染器落地（PR2）：processSuffix 探测恒 false，因此档位结论
 * 与仅判 MULTI_PROFILE 的旧行为完全一致——available/isolationAvailable 语义不变，
 * 只是多了一个显式上报字段。
 */
enum class BrowserIsolationTier(val wire: String) {
  PROFILE_API("profile-api"),
  PROCESS_SUFFIX("process-suffix"),
  UNAVAILABLE("unavailable"),
}

/** 档位解析器。谓词可注入，JVM 单测不依赖 WebViewFeature 运行态。 */
class BrowserIsolation(
  private val multiProfileSupported: () -> Boolean,
  private val processSuffixSupported: () -> Boolean = { false },
) {

  fun tier(): BrowserIsolationTier = when {
    multiProfileSupported() -> BrowserIsolationTier.PROFILE_API
    processSuffixSupported() -> BrowserIsolationTier.PROCESS_SUFFIX
    else -> BrowserIsolationTier.UNAVAILABLE
  }

  companion object {
    /**
     * 生产实例。processSuffix 谓词在兼容渲染器（PR3）落地前恒 false；
     * 届时注入「API>=29 且 :browser 渲染进程可用」的实测探测。
     */
    val DEFAULT = BrowserIsolation(multiProfileSupported = { BrowserHostProfile.supported() })
  }
}
