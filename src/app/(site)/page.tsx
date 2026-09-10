import Hero from "@/components/sections/Hero";
import Problems from "@/components/sections/Problems";
import Features from "@/components/sections/Features";
import Steps from "@/components/sections/Steps";
import Pricing from "@/components/sections/Pricing";
import FaqPreview from "@/components/sections/FaqPreview";
import DownloadCta from "@/components/sections/DownloadCta";
import { site } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS",
  description: site.description,
  url: site.url,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <Problems />
      <Features />
      <Steps />
      <Pricing />
      <FaqPreview />
      <DownloadCta />
    </>
  );
}
