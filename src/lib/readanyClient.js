import init, { read, inspect } from 'readany/web'
import wasmUrl from 'readany/readany_wasm_bg.wasm?url'

let ready = null

export async function ensureReadany() {
  if (!ready) {
    ready = init({ module_or_path: wasmUrl })
  }
  await ready
}

/**
 * Read a File/Blob into Markdown via readany (local WASM, no API key).
 * Photos and scanned PDF pages come back as unresolved — no OCR in this package.
 */
export async function readDocument(file) {
  await ensureReadany()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const options = { filename: file?.name || undefined }

  let plan = null
  try {
    plan = inspect(bytes, options)
  } catch {
    plan = null
  }

  try {
    const doc = read(bytes, options)
    return {
      markdown: String(doc?.markdown || ''),
      complete: Boolean(doc?.complete),
      unresolvedPages: Array.isArray(doc?.unresolved_pages) ? doc.unresolved_pages : [],
      receipt: String(doc?.receipt || ''),
      kind: plan?.kind || null,
      needsOcr: Boolean(plan?.needs_ocr),
      summary: plan?.summary || null,
    }
  } catch (e) {
    const kind = e?.kind || ''
    if (kind === 'unsupported' || plan?.kind === 'image') {
      return {
        markdown: '',
        complete: false,
        unresolvedPages: [1],
        receipt: '',
        kind: plan?.kind || 'image',
        needsOcr: true,
        summary: plan?.summary || 'Image needs text recognition',
        error: e,
      }
    }
    throw e
  }
}
