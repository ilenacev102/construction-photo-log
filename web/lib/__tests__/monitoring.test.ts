import { describe, it, expect } from 'vitest'
import { monitoring } from '../monitoring'

describe('MonitoringService', () => {
  it('handles captureException without throwing', () => {
    expect(() => {
      monitoring.captureException(new Error('Test error'), { userId: 'user-123' })
    }).not.toThrow()
  })

  it('handles non-Error objects safely', () => {
    expect(() => {
      monitoring.captureException('A string error')
      monitoring.captureException({ code: 500 })
    }).not.toThrow()
  })

  it('handles captureMessage without throwing', () => {
    expect(() => {
      monitoring.captureMessage('User performed action', 'info')
      monitoring.captureMessage('Warning alert', 'warning')
    }).not.toThrow()
  })
})
