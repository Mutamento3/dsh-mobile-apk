/**
 * 「插件」页 →「添加插件」下拉里的「插件市场」入口。
 *
 * 用户定例（0.15.0）：市场是**独立一页**（设置分区），不是弹窗；入口只保留在
 * 「添加插件」下拉里，原来的页内 Tab 入口舍去。
 *
 * 因此两件事都在这里做：
 *  1. `openMarketplacePage()`：点菜单项时切到市场分区（市场插件已由补丁
 *     `market-H-no-tab` 从 `settings.plugins.tab` 改为注册 `settings.section`
 *     id `android-marketplace`，复用同一个面板组件 P）。
 *  2. `hideMarketplaceNavRow()`：把该分区在设置导航里的行隐藏掉——否则除了下拉项，
 *     导航里还会多一个入口，与「原入口舍去」冲突。
 *
 * 为什么用 DOM 点击而不是导航 API：设置外壳没有公开的「切分区」接口
 * （`dsh-client-ui-settings-shell` 的客户端面里没有 navigate/openSection）。
 * 本包对设置导航本来就走 DOM 层（见 `mobile/settings-nav.ts`），这里沿用同一套做法。
 */
import type { ReactNode } from 'react'
import { IconBrowseOutlineRegular, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { tr } from '../i18n.ts'

/** 市场分区的导航标签：取自市场插件的 locale（zh = 插件市场，en = Plugin store）。 */
const MARKET_LABELS = ['插件市场', 'Plugin store']
/** 隐藏标记：避免 MutationObserver 反复处理同一行。 */
const HIDDEN_ATTR = 'data-dsh-market-nav-hidden'
/** 首次成功切到市场分区后，才隐藏导航行（避免隐藏本身干扰切换）。 */
let navigated = false

/** 说明行与末端箭头的标记（本包 mobile/settings-nav.ts 写入）。 */
const DESC_ATTR = 'data-dsh-settings-nav-desc'
const CHEVRON_ATTR = 'data-dsh-settings-nav-chevron'

/**
 * 一级行的 label：按钮里第一个非本模块添加的 `span`。
 *
 * 不能直接用 `button.textContent`：自有分区会被 `settings-nav.ts` 追加一行短说明，
 * 拼起来是「插件市场浏览社区插件…」，精确匹配必然失败（这就是点击一直走兜底弹窗的原因）。
 */
function rowLabel(button: HTMLButtonElement): string {
  const spans = Array.from(button.querySelectorAll<HTMLElement>(':scope > span'))
  const label = spans.find((node) => !node.hasAttribute(DESC_ATTR) && !node.hasAttribute(CHEVRON_ATTR))
  return (label?.textContent ?? '').trim()
}

function findMarketNavButton(): HTMLButtonElement | undefined {
  // 先找导航里的行；手机形态下导航可能被容器层移动过，故再退一步找全文档按钮。
  const inNav = Array.from(document.querySelectorAll<HTMLButtonElement>('nav button'))
  const hit = inNav.find((button) => MARKET_LABELS.includes(rowLabel(button)))
  if (hit !== undefined) return hit
  const all = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
  return all.find((button) => MARKET_LABELS.includes(rowLabel(button)))
}

/**
 * 取 React 挂在 DOM 节点上的 props（`__reactProps$…` 键）。
 *
 * 为什么要它：真机上给隐藏行派发 mousedown/click 没有触发分区切换（用户实测始终停在
 * 弹窗兜底）。直接调用行按钮的 onClick 绕开「元素不可见 / 指针事件被拦」这一类因素。
 * 键名取不到时退回真实事件序列，两条路都不改上游代码。
 */
function reactOnClick(node: Element): ((event: unknown) => void) | undefined {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
  if (key === undefined) return undefined
  const props = (node as unknown as Record<string, { onClick?: unknown }>)[key]
  const handler = props?.onClick
  return typeof handler === 'function' ? (handler as (event: unknown) => void) : undefined
}

/**
 * 切到插件市场分区（整页）。找不到导航行时返回 false。
 *
 * 走 mousedown → mouseup → click 的完整序列：上游与手机端容器都按指针事件判断
 * 「用户点了一级行」，只发 click 在部分路径上不会切换（与本包 `settings-nav.ts`
 * 里驱动返回/进入的写法一致）。
 */
export function openMarketplacePage(): boolean {
  const button = findMarketNavButton()
  if (button === undefined) return false
  const handler = reactOnClick(button)
  if (handler !== undefined) {
    try {
      handler({ nativeEvent: {}, target: button, currentTarget: button, preventDefault() {}, stopPropagation() {} })
      navigated = true
      return true
    } catch {
      // 落到下面的真实事件序列
    }
  }
  for (const type of ['mousedown', 'mouseup', 'click'] as const) {
    button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
  }
  navigated = true
  return true
}

/**
 * 市场分区是异步注册的：短时间内重试几次，避免菜单项先于导航行出现。
 * 全部重试都失败时退回市场自己的命令通道（弹窗），保证点击一定有可见结果，
 * 并在控制台留下诊断行，便于区分「分区没注册」与「导航行没渲染」。
 */
export function openMarketplacePageWithRetry(attempt = 0, ctx?: unknown): void {
  if (openMarketplacePage()) return
  if (attempt < 6) {
    window.setTimeout(() => { openMarketplacePageWithRetry(attempt + 1, ctx) }, 120)
    return
  }
  console.info('[dsh-marketplace] 未找到市场分区的导航行，退回市场自己的命令通道（弹窗）')
  openMarketplaceDialog(ctx)
}

/** 兜底：发 `store` 命令回执让市场插件打开它自己的对话框（与 `/store` 命令同一条路）。 */
export function openMarketplaceDialog(ctx: unknown): boolean {
  const emit = (ctx as { emit?: (...args: unknown[]) => void } | undefined)?.emit
  if (typeof emit !== 'function') return false
  try {
    emit.call(ctx, 'command/executed', null, 'store', { kind: 'success', query: '' })
    return true
  } catch {
    return false
  }
}

/** 隐藏市场分区的导航行；返回清理函数。 */
export function hideMarketplaceNavRow(): () => void {
  const hide = () => {
    if (!navigated) return
    const button = findMarketNavButton()
    if (button === undefined) return
    const row = (button.closest('[data-dsh-settings-nav]') ?? button.parentElement) as HTMLElement | null
    if (row === null || row.getAttribute(HIDDEN_ATTR) === 'true') return
    row.setAttribute(HIDDEN_ATTR, 'true')
    row.style.display = 'none'
  }
  hide()
  const observer = new MutationObserver(hide)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

export interface MarketplaceMenuItemProps {
  /** 菜单项渲染时由插件管理器传入，点选后先收起菜单。 */
  onDismiss?: () => void
  ctx?: unknown
}

export function MarketplaceMenuItem({ onDismiss, ctx }: MarketplaceMenuItemProps) {
  return (
    <MenuItemButton
      icon={<IconBrowseOutlineRegular size={16} />}
      onSelect={() => {
        onDismiss?.()
        openMarketplacePageWithRetry(0, ctx)
      }}
    >
      <span className="dsh-market-item">
        <span>{tr('插件市场', 'Plugin marketplace')}</span>
        <span className="dsh-market-item-desc">
          {tr('浏览社区插件，按移动端兼容性筛选', 'Browse community plugins, filtered by mobile compatibility')}
        </span>
      </span>
    </MenuItemButton>
  )
}

/**
 * 把「插件市场」注册进「添加插件」下拉。
 *
 * 插槽名 `plugins.add.actions` 由 dsh-client-ui-plugin-manager 在运行时渲染
 * （它的 `renderSlot("plugins.add.actions", { onDismiss })`），但本包依赖的
 * slots 类型版本尚未收录该名字，故这里按运行时形状断言一次，不引入 any。
 */
export function registerMarketplaceAction(slots: unknown, ctx?: unknown): () => void {
  const registry = slots as {
    inject: (name: string, factory: () => unknown) => () => void
    register: (definition: Record<string, unknown>, component: unknown) => unknown
  }
  return registry.inject('plugins.add.actions', () => registry.register({
    name: 'plugins.add.actions',
    id: 'android-marketplace',
    order: 30,
    inject: () => ({ ctx }),
  }, MarketplaceMenuItem))
}

/**
 * 插件市场的**独立页面**：本分区渲染市场插件注册的 `settings.plugins.tab` 面板
 * （`only: 'dshmarketplace'`），因此内容与它原来的 Tab 完全一致，但落点是设置分区整页。
 *
 * 为什么不让市场插件自己注册分区：它注册 `settings.section` 时依赖自己的 locale 作用域，
 * 真机上导航行没有出现（点击只能走兜底弹窗）。改由本包注册分区、渲染它的面板，
 * 导航行的存在与文案都由本包掌握，不再依赖第三方插件的注册时机。
 */
/**
 * 分区组件 props。市场面板所在的 `settings.plugins.tab` 不是本分区的子槽
 * （它属于「插件」页那个分区），因此 renderSlot 按运行时形状取，不写进类型。
 */
export type MarketplaceSectionProps = PropsRuntime<'settings.section'>

export function MarketplaceSection(props: MarketplaceSectionProps) {
  const renderSlot = (props as unknown as {
    renderSlot?: (name: string, payload: Record<string, unknown>, options?: { only?: string }) => unknown
  }).renderSlot
  // 市场面板由 market-I-panel-global 补丁挂在 window 上（它自带 t / localeService）；
  // 跨分区 renderSlot 取不到对方子槽，故这里直接渲染那个组件。
  const Panel = (window as unknown as { __dshMarketplacePanel?: React.ComponentType }).__dshMarketplacePanel
  const panel = Panel !== undefined ? <Panel /> : (renderSlot?.('settings.plugins.tab', {}, { only: 'dshmarketplace' }) as ReactNode)
  return (
    <div data-plugin="dev-marketplace">
      {/* 临时诊断行：确认面板来源，定位后删除。 */}
      <p className="dsh-market-diag" data-panel={Panel !== undefined ? 'global' : panel ? 'slot' : 'empty'}>
        {Panel !== undefined
          ? tr('面板：全局组件', 'panel: global component')
          : panel
            ? tr('面板：插槽', 'panel: slot')
            : tr('面板：空（市场插件未加载）', 'panel: empty')}
      </p>
      {panel ?? (
        <p className="dsh-market-empty">
          {tr('插件市场不可用（市场插件未加载）。', 'Plugin store is unavailable (the marketplace plugin is not loaded).')}
        </p>
      )}
    </div>
  )
}
