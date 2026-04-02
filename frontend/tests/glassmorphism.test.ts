import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Glassmorphism Effects (DSGN-07)', () => {
  const globalsPath = path.resolve(__dirname, '../src/app/globals.css')
  let cssContent: string

  beforeAll(() => {
    cssContent = fs.readFileSync(globalsPath, 'utf-8')
  })

  it('should define .glass utility class', () => {
    expect(cssContent).toMatch(/\.glass\s*\{/)
  })

  it('should include backdrop-blur in glass classes', () => {
    expect(cssContent).toMatch(/backdrop-blur/)
  })

  it('should define .glass-subtle variant', () => {
    expect(cssContent).toMatch(/\.glass-subtle\s*\{/)
  })

  it('should define .glass-strong variant', () => {
    expect(cssContent).toMatch(/\.glass-strong\s*\{/)
  })

  it('should include dark mode adjustments', () => {
    expect(cssContent).toMatch(/\.dark\s+\.glass/)
  })
})
