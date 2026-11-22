import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { request } from '../../lib/api/client'
import { queryClient } from '../../lib/api/queries'
import NotificationsPage from './NotificationsPage'

vi.mock('../../lib/api/client', () => ({ request: vi.fn() }))
const requestMock = vi.mocked(request)
const notification = {
  id: 7, customer_name: 'مشتری آزمایشی', recipient: '+989120000000',
  repair_order_id: null, event_type: 'repair_created', provider: 'smsir',
  status: 'failed', error_code: 'delivery_unknown', attempt_count: 1,
  is_retryable: false, created_at: '2026-11-22T10:00:00Z',
  last_error: 'گزارش پنل پیامکی را بررسی کنید.',
}
const page = { count: 1, results: [notification], next: null, previous: null }

beforeEach(() => {
  queryClient.clear()
  requestMock.mockReset()
})
afterEach(() => queryClient.clear())

function renderPage() {
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

it('shows uncertain delivery and does not resend when confirmation is declined', async () => {
  requestMock.mockResolvedValue(page)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderPage()
  expect(await screen.findByText('نیاز به بررسی ارسال')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'ارسال مجدد' }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(requestMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
})

it('includes explicit acknowledgement when an uncertain delivery is retried', async () => {
  requestMock.mockResolvedValueOnce(page).mockResolvedValueOnce({
    ...notification, status: 'pending', error_code: '',
  }).mockResolvedValue(page)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'ارسال مجدد' }))
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith('notifications/7/retry/', {
    method: 'POST', body: { confirm_unknown_delivery: true },
  }))
})
