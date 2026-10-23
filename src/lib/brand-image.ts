import { readFile } from "node:fs/promises"
import { join } from "node:path"

/** The brand mark as a data URI for next/og images. `square` drops the rounded corners (iOS masks its own). */
export async function logoDataUri({ square = false } = {}) {
  let svg = await readFile(join(process.cwd(), "src/app/icon.svg"), "utf8")
  if (square) svg = svg.replace('rx="15"', 'rx="0"')
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}
