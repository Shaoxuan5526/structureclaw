import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, badgeVariants } from '@/components/ui/badge'

describe('Badge Component (COMP-09)', () => {
  it('renders with default variant (bg-primary)', () => {
    render(<Badge data-testid="badge">Default</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-primary')
    expect(badge).toHaveClass('text-primary-foreground')
  })

  it('renders with secondary variant (bg-secondary)', () => {
    render(<Badge variant="secondary" data-testid="badge">Secondary</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('bg-secondary')
    expect(badge).toHaveClass('text-secondary-foreground')
  })

  it('renders with destructive variant (bg-destructive)', () => {
    render(<Badge variant="destructive" data-testid="badge">Destructive</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('bg-destructive')
    expect(badge).toHaveClass('text-destructive-foreground')
  })

  it('renders with outline variant (border only)', () => {
    render(<Badge variant="outline" data-testid="badge">Outline</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('text-foreground')
    expect(badge).not.toHaveClass('bg-primary')
    expect(badge).not.toHaveClass('bg-secondary')
    expect(badge).not.toHaveClass('bg-destructive')
  })

  it('has rounded-full shape', () => {
    render(<Badge data-testid="badge">Badge</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('rounded-full')
  })

  it('accepts custom className', () => {
    render(<Badge className="custom-class" data-testid="badge">Custom</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('custom-class')
    expect(badge).toHaveClass('rounded-full') // Still has base classes
  })

  it('exports badgeVariants for reuse', () => {
    expect(badgeVariants).toBeDefined()
    expect(typeof badgeVariants).toBe('function')
  })
})
