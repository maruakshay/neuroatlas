import { AtlasApp } from "@/components/atlas/AtlasApp"
import { disorders } from "@/data/disorders"
import { site } from "@/lib/site"

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${site.url}/#app`,
      name: site.name,
      url: site.url,
      description: site.description,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any (WebGL browser)",
      browserRequirements: "Requires WebGL",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "LearningResource",
      name: site.title,
      url: site.url,
      learningResourceType: "Interactive 3D model",
      educationalLevel: ["High school", "Undergraduate"],
      teaches: ["Brain anatomy", "Neuron structure", "Synaptic transmission", "Action potentials", "Neurological disorders"],
      inLanguage: "en",
      about: disorders.map((d) => ({ "@type": "MedicalCondition", name: d.name })),
    },
  ],
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD must be raw JSON; escape "<" so content can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <AtlasApp />
    </>
  )
}
