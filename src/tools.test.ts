import { describe, expect, it } from 'vitest'
import type { RemoteTool } from './api'
import { describeTool, mcpName, splitArguments } from './tools'

const TOOL: RemoteTool = {
  id: 'image.convert',
  title: 'Image converter',
  description: 'Convert images between formats.',
  accept: ['image/*', '.heic'],
  maxFiles: 10,
  maxBytesPerFile: 50 * 1024 * 1024,
  params: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['jpeg', 'webp'], description: 'Output format' },
      quality: { type: 'integer', default: 82, description: 'Quality' },
    },
    required: ['format', 'quality'],
  },
}

describe('имя инструмента', () => {
  // Точки в именах допускают не все клиенты MCP, и несовместимость проявилась
  // бы у человека, а не у нас.
  it('не содержит ничего, кроме букв, цифр, дефиса и подчёркивания', () => {
    expect(mcpName('image.convert')).toBe('image_convert')
    expect(mcpName('video.trim')).toBe('video_trim')
    expect(mcpName('already_fine-1')).toBe('already_fine-1')
  })
})

describe('описание инструмента для агента', () => {
  const descriptor = describeTool(TOOL)

  it('добавляет к параметрам работу с файлами', () => {
    const properties = descriptor.inputSchema['properties'] as Record<string, unknown>
    expect(Object.keys(properties)).toContain('paths')
    expect(Object.keys(properties)).toContain('outputDir')
    expect(Object.keys(properties)).toContain('format')
  })

  it('требует пути к файлам', () => {
    expect(descriptor.inputSchema['required']).toContain('paths')
  })

  // Поле со значением по умолчанию можно не передавать. Требовать его — значит
  // заставлять агента каждый раз придумывать качество, которое ему безразлично.
  it('не требует полей, у которых есть значение по умолчанию', () => {
    const required = descriptor.inputSchema['required'] as string[]
    expect(required).toContain('format')
    expect(required).not.toContain('quality')
  })

  it('рассказывает про ограничения на входные файлы', () => {
    expect(descriptor.description).toContain('image/*')
    expect(descriptor.description).toContain('50 MB')
  })
})

describe('разбор аргументов вызова', () => {
  it('отделяет наши поля от параметров инструмента', () => {
    const result = splitArguments({ paths: ['a.png'], outputDir: 'out', format: 'webp' })
    expect(result.paths).toEqual(['a.png'])
    expect(result.outputDir).toBe('out')
    expect(result.params).toEqual({ format: 'webp' })
  })

  it('без каталога назначения оставляет его незаданным', () => {
    expect(splitArguments({ paths: ['a.png'] }).outputDir).toBeUndefined()
  })

  // Аргументы приходят от языковой модели: это ровно тот вход, которому нельзя
  // верить на слово.
  it('отвергает пути не массивом и не строками', () => {
    expect(() => splitArguments({ paths: 'a.png' })).toThrow(/paths/)
    expect(() => splitArguments({ paths: [1, 2] })).toThrow(/paths/)
    expect(() => splitArguments({})).toThrow(/paths/)
    expect(() => splitArguments({ paths: ['a.png'], outputDir: 5 })).toThrow(/outputDir/)
  })
})
