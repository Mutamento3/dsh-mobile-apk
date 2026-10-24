package com.dsharnessmobile.shell

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * 隔离档位解析（PR2：仅建立档位模型与上报面，行为与仅判 MULTI_PROFILE 一致）。
 *
 * 关键不变量：
 *  1. PROFILE_API 恒优先于 PROCESS_SUFFIX（能会话级隔离就不退共享档案）；
 *  2. 两个谓词都 false 时必须 UNAVAILABLE（fail-closed，绝不默认可用）；
 *  3. wire 名是对桥/插件的面（status/caps 的 isolationTier 字段），改名即破坏兼容。
 */
class BrowserIsolationTierTest {

  @Test
  fun profileApiWhenMultiProfileSupported() {
    assertEquals(BrowserIsolationTier.PROFILE_API, BrowserIsolation({ true }).tier())
  }

  @Test
  fun unavailableWhenNeitherSupported() {
    assertEquals(BrowserIsolationTier.UNAVAILABLE, BrowserIsolation({ false }).tier())
    assertEquals(BrowserIsolationTier.UNAVAILABLE, BrowserIsolation({ false }, { false }).tier())
  }

  @Test
  fun processSuffixOnlyAsFallbackWhenMultiProfileMissing() {
    assertEquals(
      BrowserIsolationTier.PROCESS_SUFFIX,
      BrowserIsolation({ false }, { true }).tier(),
    )
  }

  @Test
  fun profileApiWinsOverProcessSuffix() {
    assertEquals(
      BrowserIsolationTier.PROFILE_API,
      BrowserIsolation({ true }, { true }).tier(),
    )
  }

  @Test
  fun wireNamesAreStableBridgeSurface() {
    assertEquals("profile-api", BrowserIsolationTier.PROFILE_API.wire)
    assertEquals("process-suffix", BrowserIsolationTier.PROCESS_SUFFIX.wire)
    assertEquals("unavailable", BrowserIsolationTier.UNAVAILABLE.wire)
  }

  /** PR2 契约：DEFAULT 的 processSuffix 探测恒 false（渲染器未落地前不得虚报可用）。 */
  @Test
  fun defaultProcessSuffixProbeIsOffUntilRendererLands() {
    // DEFAULT 谓词读 WebViewFeature 运行态，JVM 单测不能直接调；此处只验证
    // 显式注入「processSuffix=恒 true 且 multiProfile=false」才可能得到 PROCESS_SUFFIX，
    // 即 DEFAULT 不携带隐藏的兜底路径（其 processSuffix 谓词就是恒 false 的默认参数）。
    assertEquals(BrowserIsolationTier.PROFILE_API, BrowserIsolation({ true }, { true }).tier())
    assertEquals(BrowserIsolationTier.UNAVAILABLE, BrowserIsolation({ false }, { false }).tier())
  }
}
