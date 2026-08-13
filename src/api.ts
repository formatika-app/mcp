import { basename } from 'node:path'

/**
 * Клиент REST API formatika.
 *
 * Отдельный от сайта код: пакет живёт в npm у постороннего человека и не может
 * зависеть от внутренностей монорепозитория. Общее у них одно — сам протокол,
 * то есть описанное в /api/v1.
 */
export interface ApiOptions {
  readonly baseUrl: string
  /** Ключ доступа. Без него работают бесплатные суточные нормы. */
  readonly apiKey: string | undefined
}

export interface RemoteTool {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly accept: readonly string[]
  readonly maxFiles: number
  readonly maxBytesPerFile: number
  readonly params: Record<string, unknown>
}

export interface JobFile {
  readonly id: string
  readonly filename: string
  readonly mime: string
  readonly bytes: number
  readonly url: string
}

export interface JobState {
  readonly id: string
  readonly status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELED' | 'EXPIRED'
  readonly progress: number
  readonly errorCode: string | null
  readonly credits: number
  readonly files: readonly JobFile[]
}

/** Ошибка с кодом сервиса: агенту нужен разбираемый повод, а не текст. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class FormatikaApi {
  /**
   * Cookie между запросами.
   *
   * Без ключа доступа сервис узнаёт посетителя по cookie — так же, как браузер.
   * Загрузка привязывается к тому, кто её сделал, поэтому без сохранения
   * cookie следующий запрос выглядит как чужой, и задача не находит файла.
   * Программе это нужно ровно затем же, зачем браузеру.
   */
  private readonly cookies = new Map<string, string>()

  constructor(private readonly options: ApiOptions) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
    return {
      ...extra,
      ...(cookie ? { cookie } : {}),
      ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
    }
  }

  private remember(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';', 1)[0] ?? ''
      const separator = pair.indexOf('=')
      if (separator <= 0) continue
      this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim())
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    this.remember(response)
    const text = await response.text()
    const data: unknown = text ? JSON.parse(text) : null

    if (!response.ok) {
      const error =
        typeof data === 'object' && data !== null && 'error' in data
          ? (data.error as { code?: string })
          : undefined
      throw new ApiError(error?.code ?? 'HTTP_' + response.status, describe(error?.code, response))
    }
    return data as T
  }

  async tools(): Promise<readonly RemoteTool[]> {
    const response = await fetch(`${this.options.baseUrl}/api/v1/tools`, {
      headers: this.headers(),
    })
    const data = await this.parse<{ tools: RemoteTool[] }>(response)
    return data.tools
  }

  async upload(toolId: string, path: string, body: Uint8Array): Promise<string> {
    const query = new URLSearchParams({ toolId, filename: basename(path) })
    const response = await fetch(`${this.options.baseUrl}/api/v1/uploads?${query.toString()}`, {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/octet-stream' }),
      body,
    })
    const data = await this.parse<{ id: string }>(response)
    return data.id
  }

  async createJob(toolId: string, uploadIds: string[], params: unknown): Promise<JobState> {
    const response = await fetch(`${this.options.baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ toolId, uploadIds, params }),
    })
    return this.parse<JobState>(response)
  }

  async job(id: string): Promise<JobState> {
    const response = await fetch(`${this.options.baseUrl}/api/v1/jobs/${id}`, {
      headers: this.headers(),
    })
    return this.parse<JobState>(response)
  }

  async download(url: string): Promise<Uint8Array> {
    const absolute = url.startsWith('http') ? url : `${this.options.baseUrl}${url}`
    const response = await fetch(absolute, { headers: this.headers() })
    if (!response.ok) {
      throw new ApiError('DOWNLOAD_FAILED', `Could not download the result (${response.status}).`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }
}

/**
 * Пояснение к коду ошибки.
 *
 * Текст от сервиса намеренно скупой, а агенту важно понять, можно ли что-то
 * поправить и повторить, — поэтому подсказка идёт рядом с кодом. Здесь и далее
 * всё, что видит пользователь пакета, по-английски: пакет живёт в npm.
 */
function describe(code: string | undefined, response: Response): string {
  switch (code) {
    case 'RATE_LIMITED':
      return 'Too many requests. Wait a moment and try again.'
    case 'QUOTA_EXCEEDED':
      return 'The free daily allowance is used up. Set FORMATIKA_API_KEY or top up credits.'
    case 'INPUT_TOO_LARGE':
      return 'The file is larger than this tool accepts.'
    case 'UNSUPPORTED_INPUT':
      return 'This tool does not accept files of that type.'
    case 'UNKNOWN_TOOL':
      return 'No such tool.'
    case 'INVALID_PARAMS':
      return 'The arguments do not match the tool schema.'
    default:
      return `formatika replied ${response.status}${code ? ` (${code})` : ''}.`
  }
}
