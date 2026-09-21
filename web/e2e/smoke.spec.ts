import { test, expect } from '@playwright/test'

test.describe('public pages', () => {
  test('landing renders hero heading', async ({ page }) => {
    await page.goto('/mk')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 })
  })

  test('canonical locale redirect drops default prefix', async ({ page }) => {
    const res = await page.goto('/mk/signup')
    expect(res?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/signup')
  })

  test('login form renders for anonymous visitors', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /најава|sign in|login/i })).toBeVisible({ timeout: 20000 })
  })

  test('privacy page renders review disclaimer', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByText(/правен преглед/i)).toBeVisible({ timeout: 20000 })
  })

  test('blog index renders', async ({ page }) => {
    const res = await page.goto('/blog')
    expect(res?.status()).toBe(200)
  })
})

test.describe('api guard envelopes', () => {
  test('photos without auth returns 401 envelope', async ({ request }) => {
    const res = await request.get('/api/photos?projectId=x')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toBeTruthy()
  })

  test('unknown manifest returns 404 envelope', async ({ request }) => {
    const res = await request.get('/api/verify/00000000-0000-0000-0000-000000000000')
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  test('health returns status envelope', async ({ request }) => {
    const res = await request.get('/api/health')
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body).toHaveProperty('ok')
    expect(body).toHaveProperty('db')
    expect(body).toHaveProperty('storage')
  })
})
