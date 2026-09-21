import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiErrorResponse, requireAuth } from '@/lib/api/auth-guard'
import { monitoring } from '@/lib/monitoring'

const { getUserMock, createClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: null }, error: null })
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } })
})

function errWithStatus(message: string, status: number): Error {
  return Object.assign(new Error(message), { status })
}

describe('apiErrorResponse', () => {
  it('passes through the message and status for 4xx errors', async () => {
    const res = apiErrorResponse(errWithStatus('Невалиден JSON во барањето.', 400))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Невалиден JSON во барањето.')
  })

  it('passes through the message for 401 without capturing an exception', async () => {
    const captureSpy = vi.spyOn(monitoring, 'captureException').mockImplementation(() => {})
    const res = apiErrorResponse(errWithStatus('Немате пристап.', 401))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Немате пристап.')
    expect(captureSpy).not.toHaveBeenCalled()
  })

  it('returns a generic message for 5xx errors and captures the exception', async () => {
    const captureSpy = vi.spyOn(monitoring, 'captureException').mockImplementation(() => {})
    const res = apiErrorResponse(errWithStatus('ECONNREFUSED: db:5432', 503))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Внатрешна грешка на серверот.')
    expect(captureSpy).toHaveBeenCalledTimes(1)
  })

  it('returns a generic message for statusless errors and captures the exception', async () => {
    const captureSpy = vi.spyOn(monitoring, 'captureException').mockImplementation(() => {})
    const res = apiErrorResponse(new Error('raw message'))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Внатрешна грешка на серверот.')
    expect(captureSpy).toHaveBeenCalledTimes(1)
  })

  it('returns a generic message for non-Error values and captures the exception', async () => {
    const captureSpy = vi.spyOn(monitoring, 'captureException').mockImplementation(() => {})
    const res = apiErrorResponse('string failure')

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Внатрешна грешка на серверот.')
    expect(captureSpy).toHaveBeenCalledTimes(1)
  })
})

describe('requireAuth', () => {
  it('throws a 401 error when there is no authenticated user', async () => {
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 })
  })

  it('resolves with the user and supabase client when authenticated', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'a@b.mk' } },
      error: null,
    })

    const result = await requireAuth()

    expect(result.user.id).toBe('user-1')
    expect(result.supabase.auth.getUser).toBe(getUserMock)
  })
})