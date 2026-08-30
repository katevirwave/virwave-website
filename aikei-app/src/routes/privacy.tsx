import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — AIKEI" },
      {
        name: "description",
        content:
          "How AIKEI handles evaluation data, transcripts and customer build information.",
      },
      { property: "og:title", content: "Privacy — AIKEI" },
      {
        property: "og:description",
        content: "How AIKEI handles evaluation data, transcripts and build information.",
      },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Legal"
      title="Privacy."
      paragraphs={[
        "AIKEI processes the prompts, responses and metadata you submit for evaluation. Transcripts are stored so that findings remain auditable against a specific build and scenario version.",
        "Evaluation data is not used to train models. Access is limited to the accounts on your organisation, the adjudicators you assign, and AIKEI staff performing support work you have requested.",
        "You can request deletion of a run and its transcripts at any time. Signed release reports retain the finding identifiers and versions needed to keep the record consistent.",
        "For data questions, write to info@virwave.com.",
      ]}
    />
  ),
});
