import type { RemoteTool } from './api'

/**
 * Превращение инструмента сервиса в инструмент MCP.
 *
 * Разница между ними одна, но существенная: сервис работает с загруженными
 * файлами, а агент — с путями на диске. Поэтому к схеме параметров добавляются
 * `paths` и `outputDir`, а всё остальное берётся с сервера как есть.
 */
export interface McpToolDescriptor {
  readonly name: string
  readonly toolId: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
}

/**
 * Имя для MCP: точки в именах инструментов допускают не все клиенты, а
 * несовместимость проявилась бы у человека, а не у нас.
 */
export function mcpName(toolId: string): string {
  return toolId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function limits(tool: RemoteTool): string {
  const megabytes = Math.round(tool.maxBytesPerFile / (1024 * 1024))
  return `Accepts ${tool.accept.join(', ')}; up to ${megabytes} MB per file.`
}

/**
 * Обязательные поля глазами агента.
 *
 * Схема считает обязательным всё, у чего есть значение по умолчанию: в
 * результате оно и правда всегда присутствует. Но для вызывающего это не так —
 * поле с умолчанием можно не передавать, и требовать его значит заставлять
 * агента каждый раз придумывать качество сжатия, которое ему безразлично.
 */
function requiredWithoutDefaults(params: {
  properties?: Record<string, unknown>
  required?: string[]
}): string[] {
  return (params.required ?? []).filter((name) => {
    const property = params.properties?.[name]
    return !(typeof property === 'object' && property !== null && 'default' in property)
  })
}

export function describeTool(tool: RemoteTool): McpToolDescriptor {
  const params = tool.params as {
    properties?: Record<string, unknown>
    required?: string[]
  }

  return {
    name: mcpName(tool.id),
    toolId: tool.id,
    description: `${tool.title}. ${tool.description} ${limits(tool)}`,
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 25,
          description:
            'Paths to the files to process, absolute or relative to the working directory.',
        },
        outputDir: {
          type: 'string',
          description:
            'Where to put the results. Defaults to the folder each source file came from. Existing files are never overwritten.',
        },
        ...(params.properties ?? {}),
      },
      required: ['paths', ...requiredWithoutDefaults(params)],
      additionalProperties: false,
    },
  }
}

/** Аргументы вызова, разделённые на наши и предназначенные сервису. */
export function splitArguments(args: Record<string, unknown>): {
  paths: string[]
  outputDir: string | undefined
  params: Record<string, unknown>
} {
  const { paths, outputDir, ...params } = args

  if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string')) {
    throw new Error('`paths` must be an array of file paths.')
  }
  if (outputDir !== undefined && typeof outputDir !== 'string') {
    throw new Error('`outputDir` must be a path.')
  }

  return { paths: paths as string[], outputDir, params }
}
