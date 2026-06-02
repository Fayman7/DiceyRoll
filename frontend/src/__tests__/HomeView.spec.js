import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import HomeView from '../views/HomeView.vue'

vi.mock('../api', () => ({
  rollDice: vi.fn(),
  fetchDiceHistory: vi.fn(),
}))

import { rollDice, fetchDiceHistory } from '../api'

describe('HomeView', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows dice for guest and hides history list', async () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          AppMenu: { template: '<div />' },
        },
      },
    })

    expect(wrapper.findAll('button').length).toBe(6)
    expect(wrapper.text()).toContain('История бросков доступна после входа')
    expect(fetchDiceHistory).not.toHaveBeenCalled()
  })

  it('loads history for authenticated user', async () => {
    localStorage.setItem('accessToken', 'token')
    fetchDiceHistory.mockResolvedValue([
      { id: 1, dice_type: 'd6', result: 4 },
      { id: 2, dice_type: 'd20', result: 18 },
    ])
    rollDice.mockResolvedValue({ dice_type: 'd6', result: 4 })

    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          AppMenu: { template: '<div />' },
        },
      },
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(fetchDiceHistory).toHaveBeenCalled()
    expect(wrapper.text()).toContain('История бросков')
    expect(wrapper.text()).toContain('d20: 18')
  })
})
