import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea Component (COMP-04)', () => {
  it('renders textarea element with consistent Input styling', () => {
    render(<Textarea data-testid="textarea" />)
    const textarea = screen.getByTestId('textarea')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveClass('flex')
    expect(textarea).toHaveClass('rounded-md')
    expect(textarea).toHaveClass('border')
    expect(textarea).toHaveClass('border-input')
  })

  it('has same focus-visible ring state as Input', async () => {
    const user = userEvent.setup()
    render(<Textarea data-testid="textarea" />)
    const textarea = screen.getByTestId('textarea')

    await user.click(textarea)
    expect(textarea).toHaveClass('focus-visible:ring-2')
    expect(textarea).toHaveClass('focus-visible:ring-ring')
  })

  it('applies disabled styling when disabled', () => {
    render(<Textarea data-testid="textarea" disabled />)
    const textarea = screen.getByTestId('textarea')
    expect(textarea).toBeDisabled()
    expect(textarea).toHaveClass('disabled:cursor-not-allowed')
    expect(textarea).toHaveClass('disabled:opacity-50')
  })

  it('supports min-height for multi-line input', () => {
    render(<Textarea data-testid="textarea" />)
    const textarea = screen.getByTestId('textarea')
    expect(textarea).toHaveClass('min-h-[80px]')
  })
})
