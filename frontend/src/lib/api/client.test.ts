import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request, apiUrl } from './client'
import { session } from '../auth/session'
import { ApiError, flattenErrors } from './errors'
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => {
  session.clear()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  session.clear()
})
describe('API client', () => {
  it('joins base URLs without double slashes', () => {
    expect(apiUrl('/repairs/', 'https://example.test/api///')).toBe(
      'https://example.test/api/repairs/',
    )
    expect(apiUrl('accounts/', '/api/')).toBe('/api/accounts/')
  })
  it('never sends staff tokens with public tracking', async () => {
    session.set({ access: 'test-access', refresh: 'test-refresh' })
    vi.mocked(fetch).mockResolvedValue(json({ id: 1 }))
    await request('repairs/?tracking_code=RDTEST23456789', { public: true })
    const init = vi.mocked(fetch).mock.calls[0][1]!
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(init.credentials).toBe('omit')
  })
  it('shares one refresh across concurrent expired requests', async () => {
    session.set({ access: 'expired-test-access', refresh: 'test-refresh' })
    let refreshes = 0
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).endsWith('token/refresh/')) {
        refreshes++
        await Promise.resolve()
        return json({ access: 'new-test-access' })
      }
      return (init?.headers as Record<string, string>).Authorization ===
        'Bearer expired-test-access'
        ? json({}, 401)
        : json({ ok: true })
    })
    const results = await Promise.all([
      request('accounts/me/'),
      request('repairs/'),
      request('dashboard/summary/'),
    ])
    expect(refreshes).toBe(1)
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
  })
  it('clears the session after failed refresh and never loops', async () => {
    session.set({ access: 'expired', refresh: 'invalid' })
    vi.mocked(fetch).mockResolvedValue(json({}, 401))
    await expect(request('repairs/')).rejects.toBeInstanceOf(ApiError)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(session.getSnapshot()).toMatchObject({ active: false, expired: true })
  })
  it('does not log out on permission denial', async () => {
    session.set({ access: 'test', refresh: 'test' })
    vi.mocked(fetch).mockResolvedValue(
      json({ detail: 'You do not have permission to perform this action.' }, 403),
    )
    await expect(request('accounts/')).rejects.toMatchObject({
      status: 403,
      message: 'اجازه انجام این عملیات را ندارید.',
    })
    expect(session.getSnapshot().active).toBe(true)
  })
  it('does not restore a session when logout happens during refresh', async () => {
    session.set({ access: 'expired', refresh: 'test' })
    let finish!: (value: Response) => void
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith('token/refresh/')
        ? new Promise((resolve) => {
            finish = resolve
          })
        : json({}, 401),
    )
    const pending = request('repairs/')
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 })
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    session.clear()
    finish(json({ access: 'late-token' }))
    await rejected
    expect(session.access()).toBeNull()
  })
  it('propagates cancellation rather than displaying a connection error', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    await expect(
      request('repairs/', { public: true, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('does not expose HTML server errors', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>private trace</html>', { status: 500 }))
    await expect(request('repairs/', { public: true })).rejects.not.toHaveProperty(
      'message',
      '<html>private trace</html>',
    )
  })
  it('rejects a successful HTML fallback instead of treating it as API data', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>SPA fallback</html>', { status: 200 }))
    await expect(request('repairs/', { public: true })).rejects.toMatchObject({ status: 502 })
  })
  it('surfaces nested non-field validation errors', () => {
    expect(
      new ApiError(400, { new_device: { non_field_errors: ['یک مدل انتخاب کنید.'] } }).message,
    ).toBe('یک مدل انتخاب کنید.')
  })
  it('flattens nested DRF validation errors', () => {
    expect(
      flattenErrors({
        new_customer: { phone_number: ['This field is required.'] },
        non_field_errors: ['خطای اعتبارسنجی'],
      }),
    ).toEqual({
      'new_customer.phone_number': 'این فیلد الزامی است.',
      non_field_errors: 'خطای اعتبارسنجی',
    })
  })
})
