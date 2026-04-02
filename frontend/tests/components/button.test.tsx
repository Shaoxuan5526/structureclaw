import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button Component (COMP-01)', () => {
  it('renders button element by default', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
  })

  it('renders with default variant (bg-primary)', () => {
    render(<Button>Default</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-primary')
    expect(button).toHaveClass('text-primary-foreground')
  })

  it('renders with destructive variant (bg-destructive)', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
    expect(button).toHaveClass('text-destructive-foreground')
  })

  it('renders with outline variant (border, transparent bg)', () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('border')
    expect(button).toHaveClass('border-input')
    expect(button).toHaveClass('bg-background')
  })

  it('renders with ghost variant (no border, hover only)', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('hover:bg-accent')
    expect(button).not.toHaveClass('bg-primary')
  })

  it('renders with sm, md (default), lg sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('h-9')
    expect(button).toHaveClass('px-3')

    rerender(<Button size="default">Default</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('h-10')
    expect(button).toHaveClass('py-2')

    rerender(<Button size="lg">Large</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('h-11')
    expect(button).toHaveClass('px-8')
  })

  it('has focus-visible:ring-2 ring-ring for accessibility', () => {
    render(<Button>Focus Test</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('focus-visible:ring-2')
    expect(button).toHaveClass('focus-visible:ring-ring')
  })

  it('is disabled when disabled prop is true', async () => {
    const user = userEvent.setup()
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
  })

  it('renders as Slot child when asChild=true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    // Should not find a button element
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // Should find an anchor element instead
    const link = screen.getByRole('link', { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
    // Link should have button styling classes
    expect(link).toHaveClass('bg-primary')
  })
})
