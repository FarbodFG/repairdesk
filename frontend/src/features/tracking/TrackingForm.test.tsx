import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TrackingForm } from './TrackingForm'
it('labels the code input and reports invalid input accessibly', async () => {
  const onTrack = vi.fn()
  render(<TrackingForm onTrack={onTrack} />)
  await userEvent.click(screen.getByRole('button', { name: 'پیگیری تعمیر' }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'کد پیگیری سفارش' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(onTrack).not.toHaveBeenCalled()
})
it('submits a trimmed uppercase tracking code', async () => {
  const onTrack = vi.fn()
  render(<TrackingForm onTrack={onTrack} />)
  await userEvent.type(screen.getByLabelText('کد پیگیری سفارش'), ' rdabcdefgh2345 ')
  await userEvent.click(screen.getByRole('button', { name: 'پیگیری تعمیر' }))
  await waitFor(() => expect(onTrack).toHaveBeenCalledWith('RDABCDEFGH2345'))
})
