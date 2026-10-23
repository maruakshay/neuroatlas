/** Canonical site details used for metadata, sitemap and structured data. */
export const site = {
  name: "NeuroAtlas",
  title: "NeuroAtlas: Interactive 3D Brain Anatomy, from Lobes to Ion Channels",
  shortDescription: "Explore the brain in 3D from lobes to ion channels, and see what goes wrong in disease.",
  description:
    "Explore the human brain in interactive 3D, from lobes and deep nuclei down to neurons, synapses and ion channels. Simulate Alzheimer's, Parkinson's, stroke, multiple sclerosis, epilepsy and more to see what changes at every scale.",
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),
  themeColor: "#0b0b12",
}
