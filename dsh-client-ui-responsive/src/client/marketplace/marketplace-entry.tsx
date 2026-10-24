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
import { MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { tr } from '../i18n.ts'

/** 市场分区的导航标签（市场插件 `settings.tab` 文案，中英各一）。 */
const MARKET_LABELS = ['插件市场', 'Plugin marketplace']
/** 隐藏标记：避免 MutationObserver 反复处理同一行。 */
const HIDDEN_ATTR = 'data-dsh-market-nav-hidden'

function findMarketNavButton(): HTMLButtonElement | undefined {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('nav button'))
  return buttons.find((button) => MARKET_LABELS.includes((button.textContent ?? '').trim()))
}

/** 切到插件市场分区（整页）。找不到导航行时返回 false。 */
export function openMarketplacePage(): boolean {
  const button = findMarketNavButton()
  if (button === undefined) return false
  button.click()
  return true
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
}

export function MarketplaceMenuItem({ onDismiss }: MarketplaceMenuItemProps) {
  return (
    <MenuItemButton
      onSelect={() => {
        onDismiss?.()
        openMarketplacePage()
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
export function registerMarketplaceAction(slots: unknown): () => void {
  const registry = slots as {
    inject: (name: string, factory: () => unknown) => () => void
    register: (definition: Record<string, unknown>, component: unknown) => unknown
  }
  return registry.inject('plugins.add.actions', () => registry.register({
    name: 'plugins.add.actions',
    id: 'android-marketplace',
    order: 30,
  }, MarketplaceMenuItem))
}
