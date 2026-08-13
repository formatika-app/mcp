import { describe, expect, it } from 'vitest'
import { formatReport, type FileResult } from './run'

/**
 * Отчёт — единственное, что агент показывает человеку. Он должен читаться и
 * при полном успехе, и когда получилась половина.
 */
describe('отчёт о работе', () => {
  it('начинается с итога', () => {
    const results: FileResult[] = [
      { source: 'a.png', written: '/out/a.webp', bytesBefore: 8000, bytesAfter: 300 },
      { source: 'b.png', written: '/out/b.webp', bytesBefore: 8000, bytesAfter: 300 },
    ]
    expect(formatReport(results).split('\n')[0]).toBe('2 file(s) processed.')
  })

  // Частичный успех — самый важный случай: агент не должен решить, что всё
  // пропало, если не вышло с одним файлом из тридцати.
  it('честно считает неудачи', () => {
    const results: FileResult[] = [
      { source: 'a.png', written: '/out/a.webp', bytesBefore: 8000, bytesAfter: 300 },
      { source: 'b.png', error: 'The file is larger than this tool accepts.' },
    ]
    const report = formatReport(results)
    expect(report.split('\n')[0]).toBe('1 of 2 file(s) processed, 1 failed.')
    expect(report).toContain('✗ b.png — The file is larger')
  })

  it('показывает, насколько файл полегчал', () => {
    const report = formatReport([
      { source: 'a.png', written: '/out/a.webp', bytesBefore: 8000, bytesAfter: 320 },
    ])
    expect(report).toContain('8 KB → 320 B')
    expect(report).toContain('−96%')
  })

  it('не врёт про уменьшение, когда файл вырос', () => {
    const report = formatReport([
      { source: 'a.jpg', written: '/out/a.png', bytesBefore: 1000, bytesAfter: 1500 },
    ])
    expect(report).toContain('+50%')
  })
})
