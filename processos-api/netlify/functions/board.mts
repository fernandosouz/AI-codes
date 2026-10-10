import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"

// One shared copy of the board. Reading and writing both require the key (BOARD_KEY env var),
// because the page lives on GitHub Pages and anyone can find this URL.
const KEY = "board"
const MAX_BYTES = 200_000

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  })

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors })

  const expected = Netlify.env.get("BOARD_KEY")
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  if (!expected || given !== expected) return json({ error: "Chave inválida ou ausente." }, 401)

  const store = getStore({ name: "processos", consistency: "strong" })

  if (req.method === "GET") {
    const board = await store.get(KEY, { type: "json" })
    return board === null ? json({ error: "Ainda não há dados." }, 404) : json(board)
  }

  if (req.method === "PUT") {
    const text = await req.text()
    if (text.length > MAX_BYTES) return json({ error: "JSON grande demais." }, 413)
    let data: any
    try { data = JSON.parse(text) } catch { return json({ error: "Não é um JSON válido." }, 400) }
    // Full validation happens on the page; this only keeps obvious garbage out.
    if (!data || data.version !== 1 || !Array.isArray(data.processes)) {
      return json({ error: "Formato inesperado: precisa de version 1 e uma lista processes." }, 400)
    }
    await store.setJSON(KEY, data)
    return json({ ok: true, savedAt: new Date().toISOString() })
  }

  return json({ error: "Método não suportado." }, 405)
}

export const config: Config = { path: "/api/board" }
