/**
 * General-settings additions for the Android shell (issue #59): the upstream
 * Settings → General section lost the Android-only immersive status-bar toggle.
 * The shell bridge exists (androidBridge.getImmersiveMode / setImmersiveMode,
 * whose truth source is the shell's ShellState.ImmersiveMode) and the row
 * registers at the upstream settings.general.item extension point (auto
 * projected into the General section nav), mirroring DevSection.
 *
 * 0.13.3 (D6 收益省略): the font-size slider (WebView textZoom, 50–200%)
 * retired — upstream ui-theme now ships a native fontSize field (12–17px
 * content font size) rendered in the Appearance section with persistence.
 * The shell's setTextZoom bridge and persistence were removed with it.
 *
 * ST-10: the value is the bridge's getImmersiveMode() (shell pref is the truth
 * source). The localStorage key (dsh.android.immersive) is only a fallback for
 * hosts without that bridge (desktop / older shells), and this page is its sole
 * writer — no injected index.html script writes it.
 *
 * ST-09: the read goes through useShellState (mount + visible/foreground
 * re-read + write-then-read-back), never a one-shot bridge read.
 */
import { useCallback, useState } from 'react'
import { useShellState } from '../mobile/use-shell-state.ts'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls in the settings.section owner share (erased at build time, types only).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Single source of truth for the bridge types (incl. the Window.androidBridge global).
import type {} from '../android-bridge.ts'
import { sidebarSwipeEnabled, setSidebarSwipeEnabled } from '../mobile/sidebar-gestures.ts'
import { type UiLanguageMode, UI_LANGUAGE_MODES, readUiLanguage } from './ui-language.ts'
import { tr } from '../i18n.ts'

/** Full section props: the settings shell supplies only `close`. */
export type GeneralSettingsProps = PropsRuntime<'settings.general.item'>

const IMMERSIVE_KEY = 'dsh.android.immersive'

/** "Follow system" and "Chinese" are themselves localized. */
function languageLabel(mode: UiLanguageMode): string {
  if (mode === 'en') return 'English'
  if (mode === 'system') return tr('跟随系统', 'Follow system')
  return tr('中文', 'Chinese')
}

/**
 * Immersive initial value (ST-10): the shell bridge is the sole truth source
 * (ShellState.ImmersiveMode); the localStorage mirror is only the fallback for
 * hosts without that bridge, and the default stays true (the shell's default).
 * @returns the effective immersive flag for this render.
 */
function readImmersive(): boolean {
  try {
    const fromBridge = window.androidBridge?.getImmersiveMode?.()
    if (typeof fromBridge === 'boolean') return fromBridge
  } catch {
    /* bridge absent or threw: fall through to the storage mirror */
  }
  try {
    return localStorage.getItem(IMMERSIVE_KEY) !== '0'
  } catch {
    return true
  }
}

/**
 * Render the Android display and mobile sidebar-gesture settings.
 * @param props - composed slot props (contract/slots.ts).
 * @returns the section element tree.
 */
export function GeneralSettings(_props: GeneralSettingsProps) {
  // ST-09：设置页这一处也走 useShellState（挂载 + 可见/回前台重读）；ST-10：真源是壳桥。
  const [immersive, refreshImmersive] = useShellState<boolean>(readImmersive)
  /** 写失败回执（S3-17：本项是设置页里唯一**没有**失败反馈路径的开关）。 */
  const [notice, setNotice] = useState<string | null>(null)
  const [leftSwipe, setLeftSwipe] = useState(() => sidebarSwipeEnabled('left'))
  const [rightSwipe, setRightSwipe] = useState(() => sidebarSwipeEnabled('right'))
  const [language, setLanguage] = useState<UiLanguageMode>(readUiLanguage)

  const chooseLanguage = useCallback((next: UiLanguageMode) => {
    setNotice(null)
    const api = window.androidBridge
    if (api?.setUiLanguage === undefined) {
      setNotice(tr('需在安卓应用内切换。', 'Switch this in the Android app.'))
      setLanguage(readUiLanguage())
      return
    }
    let applied: UiLanguageMode = next
    try {
      // Keep the bridge as the receiver: detaching the method (const f = api.setUiLanguage)
      // drops the Java object and every call throws "non-injected object".
      applied = (api.setUiLanguage(next) as UiLanguageMode | undefined) ?? next
    } catch {
      setNotice(tr('没有保存，请重开应用再试。', 'Not saved. Reopen the app and try again.'))
      setLanguage(readUiLanguage())
      return
    }
    setLanguage(applied)
    // Reload so shell and engine rebuild with the new language.
    try {
      window.androidBridge?.reloadWebUI?.()
    } catch {
      // The preference is already saved; the next launch picks it up.
    }
  }, [])

  const toggleSidebarSwipe = useCallback((side: 'left' | 'right', enabled: boolean) => {
    if (!setSidebarSwipeEnabled(side, enabled)) {
      setNotice(tr('没有保存，浏览器存储不可用。',
        'Not saved: browser storage is unavailable.'))
      return
    }
    setNotice(null)
    if (side === 'left') setLeftSwipe(enabled)
    else setRightSwipe(enabled)
  }, [])

  const toggleImmersive = useCallback((enabled: boolean) => {
    setNotice(null)
    try {
      localStorage.setItem(IMMERSIVE_KEY, enabled ? '1' : '0')
    } catch {
      /* storage unavailable: still push to the shell */
    }
    if (window.androidBridge?.setImmersiveMode === undefined) {
      // 桌面/旧壳没有这个桥：localStorage 镜像就是本机真值，不算失败（本页是它的唯一写入者）。
      refreshImmersive()
      return
    }
    try {
      window.androidBridge.setImmersiveMode(enabled)
    } catch {
      setNotice(tr('设置没有生效，请重开应用再试。',
        'Setting not applied. Reopen the app and try again.'))
      refreshImmersive()
      return
    }
    // 写后回读：展示值一律取壳侧真值；**读回与请求不一致时如实说明**（旧实现默默回弹，
    // 用户以为点了没反应）。
    refreshImmersive()
    if (readImmersive() !== enabled) {
      setNotice(
        enabled
          ? tr('沉浸式状态栏没有开启，请检查显示权限。',
            'Immersive status bar not enabled. Check the display permission in system settings.')
          : tr('状态栏没有恢复，请重试。',
            'Status bar not restored. Try again.'),
      )
    }
  }, [refreshImmersive])

  return (
    <div data-plugin="android-general">
      <label className="dsh-dev-row" data-dsh-ui-language="">
        <span>{tr('语言', 'Language')}</span>
        {/* Segmented buttons instead of a select: the native dropdown cannot be
            driven from the page (or from accessibility automation), and each mode
            is a one-tap choice anyway. */}
        <span className="dsh-dev-lang-choices" role="group" aria-label={tr('界面语言', 'Interface language')}>
          {UI_LANGUAGE_MODES.map(mode => (<button
            key={mode}
            type="button"
            className={language === mode ? 'dsh-dev-btn dsh-dev-btn-active' : 'dsh-dev-btn'}
            data-ui-language-mode={mode}
            aria-pressed={language === mode}
            onClick={() => chooseLanguage(mode)}
          >{languageLabel(mode)}</button>))}
        </span>
      </label>
      <p className="dsh-dev-hint">
        {tr('跟随系统时使用手机语言。', 'Follow system uses the phone language.')}
      </p>
      <label className="dsh-dev-row dsh-dev-switch">
        <input
          type="checkbox"
          checked={immersive}
          onChange={(e) => toggleImmersive(e.target.checked)}
        />
        <span>{tr('沉浸式状态栏', 'Immersive status bar')}</span>
      </label>
      <p className="dsh-dev-hint">
        {tr('隐藏状态栏，边缘滑动可临时呼出。',
          'Hides the status bar; swipe from the edge to show it.')}
      </p>
      <label className="dsh-dev-row dsh-dev-switch" data-dsh-sidebar-swipe="left">
        <input type="checkbox" checked={leftSwipe} onChange={(e) => toggleSidebarSwipe('left', e.target.checked)} />
        <span>{tr('左侧栏滑动', 'Swipe from the left edge')}</span>
      </label>
      <label className="dsh-dev-row dsh-dev-switch" data-dsh-sidebar-swipe="right">
        <input type="checkbox" checked={rightSwipe} onChange={(e) => toggleSidebarSwipe('right', e.target.checked)} />
        <span>{tr('右侧栏滑动', 'Swipe from the right edge')}</span>
      </label>
      {/* 两侧栏各一行说明会把「屏幕外侧窄边保留给系统手势」逐字重复两遍；合成一行说清同一件事。 */}
      <p className="dsh-dev-hint">
        {tr('内容区左右滑动开合侧栏。',
          'Swipe the content area to open a sidebar.')}
      </p>
      {notice !== null && <p className="dsh-dev-warn">{notice}</p>}
    </div>
  )
}
