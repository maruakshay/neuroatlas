import { ImageResponse } from "next/og"
import { logoDataUri } from "@/lib/brand-image"
import { site } from "@/lib/site"

export const alt = site.title
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const SCALES = ["Whole brain", "Neural tissue", "Neuron", "Synapse", "Ion channels"]
const DISORDERS = ["Alzheimer's", "Parkinson's", "Stroke", "Multiple sclerosis", "Epilepsy", "+10 more"]

export default async function OpengraphImage() {
  const logo = await logoDataUri()
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: "white",
          background: "radial-gradient(ellipse at 85% 20%, #3b1d5e 0%, #15121f 45%, #0b0b12 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          { }
          <img src={logo} width={96} height={96} alt="" />
          <div style={{ display: "flex", fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>
            <span>Neuro</span>
            <span style={{ color: "#c084fc", marginLeft: -9 }}>Atlas</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 940 }}>
            The brain in 3D, from lobes down to ion channels
          </div>
          <div style={{ fontSize: 30, color: "#b4b0c8", maxWidth: 940 }}>
            Explore every structure, then simulate disease and watch what breaks at each scale.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {SCALES.map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {i > 0 && <div style={{ color: "#6b6880", fontSize: 24 }}>›</div>}
                <div
                  style={{
                    display: "flex",
                    padding: "8px 18px",
                    borderRadius: 999,
                    fontSize: 24,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  {s}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 22, color: "#fca5a5" }}>
            {DISORDERS.map((d) => (
              <div key={d} style={{ display: "flex", padding: "6px 14px", borderRadius: 999, background: "rgba(239,68,68,0.14)" }}>
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  )
}
