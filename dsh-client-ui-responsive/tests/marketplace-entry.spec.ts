// @vitest-environment jsdom
// 插件市场入口（0.15.0 用户定例）：市场是独立一页（设置分区），入口只在「添加插件」下拉。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hideMarketplaceNavRow, openMarketplacePage } from '../src/client/marketplace/marketplace-entry.tsx'

function mountNav(label: string) {
  document.body.innerHTML = ''
  const nav = document.createElement('nav')
  const row = document.createElement('div')
  row.setAttribute('data-dsh-settings-nav', 'other')
  const button = document.createElement('button')
  button.textContent = label
  row.appendChild(button)
  nav.appendChild(row)
  document.body.appendChild(nav)
  return { row, button }
}

afterEach(() => { document.body.innerHTML = '' })

describe('插件市场入口', () => {
  it('点菜单项切到市场分区（点击导航行）', () => {
    const { button } = mountNav('插件市场')
    const clicked = vi.fn()
    button.addEventListener('click', clicked)
    expect(openMarketplacePage()).toBe(true)
    expect(clicked).toHaveBeenCalledOnce()
  })

  it('英文标签同样可识别', () => {
    const { button } = mountNav('Plugin marketplace')
    const clicked = vi.fn()
    button.addEventListener('click', clicked)
    expect(openMarketplacePage()).toBe(true)
    expect(clicked).toHaveBeenCalledOnce()
  })

  it('导航里没有市场行时安全返回 false', () => {
    mountNav('通用设置')
    expect(openMarketplacePage()).toBe(false)
  })

  it('市场分区行被隐藏（只留下拉入口），且不重复处理', () => {
    const { row } = mountNav('插件市场')
    const stop = hideMarketplaceNavRow()
    expect(row.style.display).toBe('none')
    expect(row.getAttribute('data-dsh-market-nav-hidden')).toBe('true')
    stop()
  })
})
