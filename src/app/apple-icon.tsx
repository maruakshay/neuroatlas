import { ImageResponse } from "next/og"
import { logoDataUri } from "@/lib/brand-image"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default async function AppleIcon() {
  const src = await logoDataUri({ square: true })
  return new ImageResponse(
    (
       
      <img src={src} width={180} height={180} alt="" />
    ),
    size,
  )
}
