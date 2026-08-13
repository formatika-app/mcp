import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { FormatikaApi, type RemoteTool } from './api'
import { formatReport, runOnFiles } from './run'
import { describeTool, splitArguments } from './tools'

/**
 * MCP-сервер formatika.
 *
 * Список инструментов берётся из живого API, а не вшивается в пакет: иначе он
 * замерзал бы на момент публикации в npm и расходился бы с тем, что сервис
 * умеет на самом деле. Источник правды остаётся один — реестр на сервере.
 *
 * Ключ доступа необязателен: без него работает бесплатная суточная норма, и
 * подключение сводится к одной строке в настройках клиента.
 */
const BASE_URL = process.env.FORMATIKA_URL ?? 'https://formatika.app'
const API_KEY = process.env.FORMATIKA_API_KEY

const api = new FormatikaApi({ baseUrl: BASE_URL, apiKey: API_KEY })

/**
 * Список инструментов спрашивается один раз за запуск.
 *
 * Спрашивать на каждый вызов — лишний круг к серверу в ответ на каждое
 * действие агента; не спрашивать вовсе нельзя. Клиент MCP переподключается
 * достаточно часто, чтобы новые инструменты появлялись сами.
 */
let cached: readonly RemoteTool[] | undefined

async function tools(): Promise<readonly RemoteTool[]> {
  cached ??= await api.tools()
  return cached
}

const server = new Server({ name: 'formatika', version: '0.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: (await tools()).map((tool) => {
    const descriptor = describeTool(tool)
    return {
      name: descriptor.name,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema,
    }
  }),
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const wanted = request.params.name
  const tool = (await tools()).find((candidate) => describeTool(candidate).name === wanted)

  if (!tool) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `Unknown tool: ${wanted}` }],
    }
  }

  try {
    const { paths, outputDir, params } = splitArguments(request.params.arguments ?? {})
    const results = await runOnFiles(api, tool.id, paths, params, outputDir)

    return {
      // Ошибкой считается только полный провал: частичный успех агенту нужно
      // видеть как результат, иначе он выбросит и то, что получилось.
      isError: results.every((result) => result.error),
      content: [{ type: 'text' as const, text: formatReport(results) }],
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: error instanceof Error ? error.message : String(error),
        },
      ],
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
