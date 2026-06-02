import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AppMenu from '../components/AppMenu.vue'

vi.mock('../api', () => ({
  logout: vi.fn(),
}))

function makeToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

describe('AppMenu', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows guest menu without private links', async () => {
    const wrapper = mount(AppMenu, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Главная')
    expect(text).toContain('Вход')
    expect(text).not.toContain('Панель админа')
    expect(text).not.toContain('Изображения')
  })

  it('shows admin link for admin token', async () => {
    localStorage.setItem('accessToken', makeToken({ isAdmin: true }))
    const wrapper = mount(AppMenu, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Панель админа')
    expect(wrapper.text()).toContain('Выйти')
  })
})
