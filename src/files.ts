import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'

/**
 * Работа с файлами на машине человека.
 *
 * Здесь два правила, и оба про доверие. Сервер запускает не человек, а агент, и
 * ошибка агента не должна стоить пользователю его файлов.
 *
 * Первое: ничего не перезаписываем. Если имя занято, добавляем номер. Агент,
 * перепутавший каталог, потратит место на диске, но не сотрёт оригиналы.
 *
 * Второе: пути приводятся к абсолютным от рабочего каталога и никуда за него
 * не выводятся сами по себе — но каталог назначения человек может указать
 * любой, включая внешний: запрещать это было бы враньём про возможности.
 */
export async function readInput(path: string): Promise<{ absolute: string; bytes: Uint8Array }> {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path)
  const bytes = await readFile(absolute)
  return { absolute, bytes: new Uint8Array(bytes) }
}

/** Свободное имя рядом с занятым: `photo.webp` → `photo-1.webp`. */
async function freeName(target: string): Promise<string> {
  const extension = extname(target)
  const base = target.slice(0, target.length - extension.length)

  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = attempt === 0 ? target : `${base}-${attempt}${extension}`
    try {
      await access(candidate)
    } catch {
      return candidate
    }
  }
  throw new Error(`Too many files named like ${target}`)
}

export async function writeOutput(
  directory: string,
  filename: string,
  bytes: Uint8Array,
): Promise<string> {
  const absolute = isAbsolute(directory) ? directory : resolve(process.cwd(), directory)
  await mkdir(absolute, { recursive: true })

  const target = await freeName(join(absolute, filename))
  await writeFile(target, bytes)
  return target
}

/** Куда класть результат, если человек не сказал: рядом с исходником. */
export function defaultOutputDir(inputPath: string): string {
  return dirname(inputPath)
}
