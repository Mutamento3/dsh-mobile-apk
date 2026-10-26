package com.dsharnessmobile.shell

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Actual native consent and page delivery; fixtures never contain real credentials. */
@RunWith(AndroidJUnit4::class)
class ClipboardReadDeviceTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private lateinit var activity: MainActivity
  private lateinit var controller: ClipboardReadController
  private lateinit var testPage: WebView
  private lateinit var clipboard: ClipboardManager
  private var previous: ClipData? = null

  @Before fun prepare() {
    activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as MainActivity
    instrumentation.waitForIdleSync()
    instrumentation.runOnMainSync {
      testPage = WebView(activity)
      testPage.settings.javaScriptEnabled = true
      (activity.window.decorView as ViewGroup).addView(testPage, ViewGroup.LayoutParams(1, 1))
      testPage.loadDataWithBaseURL("https://clipboard.test/", "<html><body>Clipboard fixture</body></html>", "text/html", "UTF-8", "https://clipboard.test/")
    }
    val deadline = System.nanoTime() + 20_000_000_000L
    var ready = false
    while (!ready && System.nanoTime() < deadline) {
      instrumentation.runOnMainSync { ready = activity.hasWindowFocus() && testPage.url != null }
      if (ready) ready = evaluate("location.href==='https://clipboard.test/'&&document.readyState==='complete'") == "true"
      if (!ready) Thread.sleep(50)
    }
    assertTrue("Foreground WebView is ready before requesting native consent", ready)
    instrumentation.runOnMainSync {
      clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      previous = clipboard.primaryClip
      clipboard.setPrimaryClip(ClipData.newPlainText("test", "fixture-clipboard-value"))
      controller = ClipboardReadController(activity, { testPage }, { it == "https://clipboard.test/" })
    }
    evaluate("window.__clipboardTestOutcome=null;window.__clipboardTestListener=e=>{window.__clipboardTestOutcome={id:e.detail.requestId,ok:e.detail.ok,exact:e.detail.text==='fixture-clipboard-value'}};window.addEventListener('dsh:clipboard-text',window.__clipboardTestListener);true")
    instrumentation.runOnMainSync {
      assertEquals("Native WebView URL matches its owned page", "https://clipboard.test/", testPage.url)
    }
  }

  @After fun release() {
    if (::controller.isInitialized) instrumentation.runOnMainSync { controller.cancel() }
    if (::activity.isInitialized) evaluate("window.removeEventListener('dsh:clipboard-text',window.__clipboardTestListener);delete window.__clipboardTestOutcome;delete window.__clipboardTestListener;true")
    if (::clipboard.isInitialized) instrumentation.runOnMainSync {
      previous?.let(clipboard::setPrimaryClip) ?: run {
        if (android.os.Build.VERSION.SDK_INT >= 28) clipboard.clearPrimaryClip()
        else clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
      }
    }
    if (::testPage.isInitialized) instrumentation.runOnMainSync {
      (testPage.parent as? ViewGroup)?.removeView(testPage)
      testPage.destroy()
    }
  }

  private fun prompt(): AlertDialog? {
    val field = ClipboardReadController::class.java.getDeclaredField("dialog")
    field.isAccessible = true
    return field.get(controller) as AlertDialog?
  }

  private fun evaluate(source: String): String {
    val done = CountDownLatch(1)
    var result = ""
    instrumentation.runOnMainSync { testPage.evaluateJavascript(source) { result = it; done.countDown() } }
    assertTrue("WebView evaluation completed", done.await(10, TimeUnit.SECONDS))
    return result
  }

  @Test fun consentPrecedesDeliveryAndCancelDoesNotExposeText() {
    instrumentation.runOnMainSync { controller.request("cancel_request_01") }
    assertTrue(prompt()?.isShowing == true)
    assertEquals("null", evaluate("window.__clipboardTestOutcome"))
    instrumentation.runOnMainSync { prompt()!!.getButton(AlertDialog.BUTTON_NEGATIVE).performClick() }
    assertEquals("true", evaluate("window.__clipboardTestOutcome.ok===false&&window.__clipboardTestOutcome.exact===false"))
  }

  @Test fun explicitConfirmationDeliversOnlyToTheOwnedRequest() {
    instrumentation.runOnMainSync {
      controller.request("confirm_request_01")
      assertNotNull("Native prompt admission: focus=${activity.hasWindowFocus()}, finishing=${activity.isFinishing}, destroyed=${activity.isDestroyed}, url=${testPage.url}", prompt())
    }
    assertEquals("null", evaluate("window.__clipboardTestOutcome"))
    instrumentation.runOnMainSync { prompt()!!.getButton(AlertDialog.BUTTON_POSITIVE).performClick() }
    assertEquals("true", evaluate("window.__clipboardTestOutcome.ok===true&&window.__clipboardTestOutcome.exact===true&&window.__clipboardTestOutcome.id==='confirm_request_01'"))
  }

  @Test fun wrongCancellationCannotRevokeOwnerAndStaleConsentCannotRead() {
    lateinit var stale: AlertDialog
    instrumentation.runOnMainSync {
      controller.request("owned_request_01")
      stale = prompt()!!
      controller.cancel("other_request_01")
      assertTrue(stale.isShowing)
      controller.cancel("owned_request_01")
      controller.request("owned_request_01")
      stale.getButton(AlertDialog.BUTTON_POSITIVE).performClick()
      assertTrue(prompt()?.isShowing == true)
    }
    assertEquals("null", evaluate("window.__clipboardTestOutcome"))
  }

  @Test fun expiredConfirmationDoesNotPublishEvenBeforeTimeoutCallbackRuns() {
    instrumentation.runOnMainSync {
      controller.request("expired_request_01")
      val field = ClipboardReadController::class.java.getDeclaredField("expiresAtNanos")
      field.isAccessible = true
      field.setLong(controller, 0L)
      prompt()!!.getButton(AlertDialog.BUTTON_POSITIVE).performClick()
    }
    instrumentation.waitForIdleSync()
    instrumentation.runOnMainSync { assertNull(prompt()) }
    assertEquals("null", evaluate("window.__clipboardTestOutcome"))
  }

  @Test fun invalidRequestAndUntrustedPageCannotOpenConsentOrPublishText() {
    instrumentation.runOnMainSync {
      controller.request("bad!")
      assertNull(prompt())
      val rejected = ClipboardReadController(activity, { testPage }, { false })
      rejected.request("untrusted_request_01")
      val field = ClipboardReadController::class.java.getDeclaredField("dialog")
      field.isAccessible = true
      assertNull(field.get(rejected))
      rejected.cancel()
    }
    assertEquals("null", evaluate("window.__clipboardTestOutcome"))
  }
}
