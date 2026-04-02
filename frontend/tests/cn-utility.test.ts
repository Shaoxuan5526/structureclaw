import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn() Utility (DSGN-04)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('should merge conflicting Tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })
})
