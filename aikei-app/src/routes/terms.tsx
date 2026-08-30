import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — AIKEI" },
      {
        name: "description",
        content: "The terms covering use of AIKEI release testing and release reports.",
      },
      { property: "og:title", content: "Terms — AIKEI" },
      {
        property: "og:description",
        content: "Terms covering use of AIKEI release testing and release reports.",
      },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Legal"
      title="Terms."
      paragraphs={[
        "AIKEI provides evaluation results and a recommendation. The release decision remains yours. A report describes the build, scenario packs and evaluator versions used at the time of the run.",
        "You are responsible for the accuracy of the build endpoint and context you submit, and for the adjudication decisions your reviewers record.",
        "Scenario packs, evaluators and report formats are versioned. Changes are published with a new version rather than applied to past runs.",
        "For contract questions, write to hello@virwave.com.",
      ]}
    />
  ),
});
