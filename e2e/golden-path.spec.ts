import { test, expect } from '@playwright/test'

test.describe('CAREi Golden Path', () => {
  test('carer can login, clock in, confirm meds, clock out, generate handover, and submit', async ({ page }) => {
    // 1. Splash → Login
    await page.goto('/')
    await page.getByRole('button', { name: /start shift/i }).click()
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()

    // 2. Login → OTP (email method)
    await page.getByRole('button', { name: /email/i }).click()
    await page.getByPlaceholder(/carer@agency/i).fill('test@carei.dev')
    await page.getByRole('button', { name: /send otp/i }).click()

    // 3. OTP screen shows development OTP
    await expect(page.getByText(/development.*otp code/i)).toBeVisible()
    const otpText = await page.locator('div.font-mono').textContent()
    const otp = otpText?.trim() || '000000'
    for (const digit of otp) {
      await page.locator('input[maxLength="1"]').first().fill(digit)
    }
    await page.getByRole('button', { name: /verify/i }).click()

    // 4. Dashboard
    await expect(page.getByText(/today's visits/i)).toBeVisible()

    // 5. Start a visit (first card)
    await page.locator('a, button').filter({ hasText: /clock in/i }).first().click()
    await expect(page.getByText(/pre-visit briefing/i)).toBeVisible()

    // 6. Clock In
    await page.getByRole('button', { name: /clock in/i }).click()
    await expect(page.getByText(/fluid intake/i)).toBeVisible()

    // 7. Confirm medications
    await page.locator('div.cursor-pointer').filter({ hasText: /medications/i }).click()
    const confirmButtons = await page.getByRole('button', { name: /confirm/i }).all()
    for (const btn of confirmButtons) {
      await btn.click()
    }
    await page.getByRole('button', { name: /close/i }).click()

    // 8. Complete a task
    await page.locator('button').filter({ hasText: /personal care/i }).click()

    // 9. Add fluid
    await page.getByRole('button', { name: /add 250ml fluid/i }).click()

    // 10. Clock Out
    await page.getByRole('button', { name: /clock out/i }).click()
    await page.getByRole('button', { name: /confirm clock out/i }).click()

    // 11. Summary screen
    await expect(page.getByText(/visit summary/i)).toBeVisible()

    // 12. Generate handover
    await page.getByRole('button', { name: /generate handover/i }).click()
    await expect(page.locator('textarea')).toHaveValue(/./)

    // 13. Submit handover
    await page.getByRole('button', { name: /submit handover/i }).click()
    await expect(page.getByText(/dashboard/i)).toBeVisible()
  })
})
