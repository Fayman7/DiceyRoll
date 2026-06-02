import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AuthView from '../views/AuthView.vue'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('AuthView', () => {
  beforeEach(() => {
    localStorage.clear()
    pushMock.mockReset()
    global.fetch = vi.fn()
  })

  it('logs in and stores tokens', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'a', refreshToken: 'r', id: 11 }),
    })

    const wrapper = mount(AuthView)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('user')
    await inputs[1].setValue('pass')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(localStorage.getItem('accessToken')).toBe('a')
    expect(localStorage.getItem('refreshToken')).toBe('r')
    expect(localStorage.getItem('userId')).toBe('11')
    expect(pushMock).toHaveBeenCalledWith('/')
  })
})
