/**
 * 「插件」页 →「添加插件」下拉菜单里的「插件市场」入口。
 *
 * 背景（0.15.0 用户定例）：插件市场原本是「插件」页里的一个 Tab（由 dshmarketplace-plugin
 * 注册 `settings.plugins.tab`），用户要求把它挪进「添加插件」下拉，并去掉原来的入口。
 *
 * 打开方式复用市场插件自己的入口：它监听 `command/executed`，收到 `store` 命令的
 * success 结果就打开市场对话框（与 `/store` 命令同一条路，没有另开导航通道）。
 * 因此这里只发同一条事件，不直接操作任何面板状态。
 */
import { MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { tr } from '../i18n.ts'

/** 触发市场插件的 `store` 命令回执；成功派发返回 true。 */
export function openMarketplace(ctx: unknown): boolean {
  const emit = (ctx as { emit?: (...args: unknown[]) => void } | undefined)?.emit
  if (typeof emit !== 'function') return false
  try {
    // 事件签名与 dsh-client-ui-commands 一致：(sessionId, name, result)。
    // 市场侧只读 name/result，sessionId 传 null 即可。
    emit.call(ctx, 'command/executed', null, 'store', { kind: 'success', query: '' })
    return true
  } catch {
    return false
  }
}

export interface MarketplaceMenuItemProps {
  /** 菜单项渲染时由插件管理器传入，点选后先收起菜单。 */
  onDismiss?: () => void
  ctx?: unknown
}

export function MarketplaceMenuItem({ onDismiss, ctx }: MarketplaceMenuItemProps) {
  return (
    <MenuItemButton
      onSelect={() => {
        onDismiss?.()
        openMarketplace(ctx)
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
 * slots 类型版本尚未收录该名字，故这里按运行时的形状断言一次，不引入 any。
 */
export function registerMarketplaceAction(slots: unknown, ctx: unknown): () => void {
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
