import { basename } from 'node:path'
import { ApiError, type FormatikaApi, type JobState } from './api'
import { defaultOutputDir, readInput, writeOutput } from './files'

/**
 * Один вызов инструмента: файлы с диска — в сервис и обратно на диск.
 *
 * Каждый файл идёт своей задачей, а не пачкой в одной. Так сбой на одном
 * снимке из тридцати не отменяет остальные двадцать девять, и агент видит
 * построчно, что получилось, а что нет.
 */
export interface FileResult {
  readonly source: string
  readonly written?: string
  readonly bytesBefore?: number
  readonly bytesAfter?: number
  readonly error?: string
}

const POLL_INTERVAL_MS = 700
const POLL_TIMEOUT_MS = 180_000

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForJob(api: FormatikaApi, id: string): Promise<JobState> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  for (;;) {
    const job = await api.job(id)
    if (job.status === 'DONE') return job
    if (job.status === 'FAILED' || job.status === 'CANCELED' || job.status === 'EXPIRED') {
      throw new ApiError(job.errorCode ?? job.status, `Job ${job.status.toLowerCase()}.`)
    }
    if (Date.now() > deadline) throw new ApiError('TIMEOUT', 'The job is taking too long.')
    await sleep(POLL_INTERVAL_MS)
  }
}

export async function runOnFiles(
  api: FormatikaApi,
  toolId: string,
  paths: readonly string[],
  params: unknown,
  outputDir: string | undefined,
): Promise<FileResult[]> {
  const results: FileResult[] = []

  for (const path of paths) {
    try {
      const { absolute, bytes } = await readInput(path)

      const uploadId = await api.upload(toolId, absolute, bytes)
      const created = await api.createJob(toolId, [uploadId], params)
      const job = await waitForJob(api, created.id)

      const target = outputDir ?? defaultOutputDir(absolute)

      for (const file of job.files) {
        const content = await api.download(file.url)
        const written = await writeOutput(target, file.filename, content)
        results.push({
          source: basename(absolute),
          written,
          bytesBefore: bytes.byteLength,
          bytesAfter: content.byteLength,
        })
      }

      if (job.files.length === 0) {
        results.push({ source: basename(absolute), error: 'The job produced no files.' })
      }
    } catch (error) {
      results.push({
        source: basename(path),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}

/**
 * Отчёт для агента.
 *
 * Не «готово», а что именно получилось: агент показывает это человеку и по
 * этому же тексту решает, надо ли что-то повторить.
 */
export function formatReport(results: readonly FileResult[]): string {
  const lines = results.map((result) => {
    if (result.error) return `✗ ${result.source} — ${result.error}`

    const before = result.bytesBefore ?? 0
    const after = result.bytesAfter ?? 0
    const change =
      before > 0 && after > 0 ? ` (${kb(before)} → ${kb(after)}, ${percent(before, after)})` : ''
    return `✓ ${result.source} → ${result.written}${change}`
  })

  const failed = results.filter((result) => result.error).length
  const summary =
    failed === 0
      ? `${results.length} file(s) processed.`
      : `${results.length - failed} of ${results.length} file(s) processed, ${failed} failed.`

  return [summary, ...lines].join('\n')
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`
}

function percent(before: number, after: number): string {
  const delta = Math.round((1 - after / before) * 100)
  return delta > 0 ? `−${delta}%` : `+${Math.abs(delta)}%`
}
