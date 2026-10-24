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
import { IconBrowseOutlineRegular, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { tr } from '../i18n.ts'

/** 市场分区的导航标签：取自市场插件的 locale（zh = 插件市场，en = Plugin store）。 */
const MARKET_LABELS = ['插件市场', 'Plugin store']
/** 隐藏标记：避免 MutationObserver 反复处理同一行。 */
const HIDDEN_ATTR = 'data-dsh-market-nav-hidden'

function findMarketNavButton(): HTMLButtonElement | undefined {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('nav button'))
  return buttons.find((button) => MARKET_LABELS.includes((button.textContent ?? '').trim()))
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
  for (const type of ['mousedown', 'mouseup', 'click'] as const) {
    button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
  }
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
