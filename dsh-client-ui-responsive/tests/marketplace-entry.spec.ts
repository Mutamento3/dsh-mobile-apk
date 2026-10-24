// @vitest-environment jsdom
// 插件市场入口（0.15.0 用户定例）：入口从「插件」页的 Tab 挪到「添加插件」下拉。
// 打开方式复用市场插件自己的命令通道——这里只钉两件事：派发的是同一条事件、缺通道时不抛。
import { describe, expect, it, vi } from 'vitest'
import { openMarketplace } from '../src/client/marketplace/marketplace-entry.tsx'

describe('插件市场入口', () => {
  it('派发 command/executed 的 store 回执（市场插件据此打开对话框）', () => {
    const emit = vi.fn()
    expect(openMarketplace({ emit })).toBe(true)
    expect(emit).toHaveBeenCalledOnce()
    const [name, sessionId, command, result] = emit.mock.calls[0]!
    expect(name).toBe('command/executed')
    expect(sessionId).toBeNull()
    expect(command).toBe('store')
    expect(result).toEqual({ kind: 'success', query: '' })
  })

  it('没有 emit 通道时安全降级（不抛异常、返回 false）', () => {
    expect(openMarketplace(undefined)).toBe(false)
    expect(openMarketplace({})).toBe(false)
  })

  it('emit 抛异常时也被吞掉', () => {
    const emit = vi.fn(() => { throw new Error('boom') })
    expect(openMarketplace({ emit })).toBe(false)
  })
})
