import { useState } from "react";

type Node = {
  id: string;
  title: string;
  detail: string;
  links: string[];
};

type Column = {
  key: string;
  eyebrow: string;
  note: string;
  nodes: Node[];
};

const COLUMNS: Column[] = [
  {
    key: "team",
    eyebrow: "01 / Your team",
    note: "The people who own the ship decision.",
    nodes: [
      { id: "product", title: "Product", detail: "Defines what the release changes and who it reaches.", links: ["intake"] },
      { id: "eng", title: "Engineering", detail: "Owns the endpoint, the prompts, the model and retrieval config.", links: ["intake", "endpoint"] },
      { id: "legal", title: "Safety and legal", detail: "Has to defend the decision after launch.", links: ["adjudication", "evidence-out"] },
    ],
  },
  {
    key: "console",
    eyebrow: "02 / Console",
    note: "The workflow your team sees. Six steps, no configuration language.",
    nodes: [
      { id: "intake", title: "Release intake", detail: "Register the release and what changed since the last one.", links: ["context"] },
      { id: "context-setup", title: "Context setup", detail: "Age bands, use case, geography, deployment surface.", links: ["context"] },
      { id: "pack", title: "Pack selection", detail: "The test packs that match the declared context.", links: ["packs"] },
      { id: "review", title: "Run review", detail: "Read the transcripts and the findings attached to them.", links: ["behaviour"] },
      { id: "adjudication", title: "Adjudication", detail: "Confirm, waive or escalate each finding, with a named reviewer.", links: ["evidence", "decision"] },
      { id: "report", title: "Release report", detail: "One document a regulator or an investor can read.", links: ["evidence-out"] },
    ],
  },
  {
    key: "plane",
    eyebrow: "03 / Control plane",
    note: "The part we own. This is where the judgement lives.",
    nodes: [
      { id: "context", title: "Product context compiler", detail: "Turns your declared context into the constraints a test has to respect.", links: ["taxonomy", "regmap"] },
      { id: "taxonomy", title: "Child-risk taxonomy", detail: "Named risks: secrecy, dependency, manipulation, age mismatch, unsafe advice, data capture.", links: ["packs"] },
      { id: "packs", title: "Test pack service", detail: "Selects multi-turn scenarios for the declared age band and use case.", links: ["orchestration"] },
      { id: "orchestration", title: "Run orchestration", detail: "Runs the scenarios against your endpoint and your existing eval stack.", links: ["endpoint", "evalstack", "behaviour"] },
      { id: "behaviour", title: "Behavioural evaluator", detail: "Scores trajectories across turns, not single answers.", links: ["evidence"] },
      { id: "evidence", title: "Evidence normalizer", detail: "Every finding is bound to the transcript turns that produced it.", links: ["comparison", "evidence-out"] },
      { id: "comparison", title: "Release comparison", detail: "This release against the last one, per risk.", links: ["decision", "regressions"] },
      { id: "regressions", title: "Regression library", detail: "Confirmed failures become permanent tests for every future release.", links: ["regressions-out"] },
    ],
  },
  {
    key: "integrations",
    eyebrow: "04 / Integrations",
    note: "We do not replace your stack. We read from it.",
    nodes: [
      { id: "endpoint", title: "Your endpoint or app", detail: "The surface a child actually talks to.", links: ["orchestration"] },
      { id: "evalstack", title: "Existing eval stack", detail: "Braintrust, LangSmith, provider evals. Their outputs become inputs.", links: ["evidence"] },
      { id: "providers", title: "Model and cloud providers", detail: "Model version and configuration are recorded as part of the evidence.", links: ["evidence"] },
    ],
  },
];

const OUTPUTS: Node[] = [
  { id: "evidence-out", title: "Evidence trail", detail: "Findings, transcripts, reviewers and timestamps in one record.", links: ["legal"] },
  { id: "decision", title: "Ship, fix or stop", detail: "One recommendation with the reason attached.", links: ["legal"] },
  { id: "regressions-out", title: "Saved regressions", detail: "The failures you already fixed stay fixed.", links: ["product"] },
];

const ALL: Node[] = [...COLUMNS.flatMap((c) => c.nodes), ...OUTPUTS];

function related(id: string | null) {
  if (!id) return new Set<string>();
  const set = new Set<string>([id]);
  const node = ALL.find((n) => n.id === id);
  node?.links.forEach((l) => set.add(l));
  ALL.forEach((n) => {
    if (n.links.includes(id)) set.add(n.id);
  });
  return set;
}

export default function ArchitectureDiagram() {
  const [active, setActive] = useState<string | null>("behaviour");
  const highlight = related(active);
  const current = ALL.find((n) => n.id === active);

  const cell = (n: Node) => {
    const on = highlight.has(n.id);
    const selected = active === n.id;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => setActive(n.id)}
        onMouseEnter={() => setActive(n.id)}
        className="block w-full border px-3 py-3 text-left transition-colors duration-200"
        style={{
          borderColor: on ? "var(--line-strong)" : "var(--line)",
          color: on ? "var(--ink)" : "var(--muted)",
          background: selected ? "var(--panel)" : "transparent",
        }}
      >
        <span className="text-[14px] leading-[1.35]">{n.title}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.key}>
            <p className="eyebrow">{col.eyebrow}</p>
            <p className="mt-3 max-w-[34ch] text-[13px] text-muted">{col.note}</p>
            <div className="mt-5 flex flex-col gap-2">{col.nodes.map(cell)}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-rule pt-10">
        <p className="eyebrow">Outputs to your team</p>
        <div className="mt-5 grid gap-2 md:grid-cols-3">{OUTPUTS.map(cell)}</div>
      </div>

      <div
        className="mt-10 border p-5"
        style={{ borderColor: "var(--line)", background: "var(--panel)" }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          {current ? current.id : "select a step"}
        </p>
        <p className="mt-3 text-[20px] text-ink md:text-[24px]">{current?.title}</p>
        <p className="mt-2 max-w-[62ch] text-[15px] text-muted">{current?.detail}</p>
        {current && current.links.length > 0 && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
            feeds {current.links.map((l) => ALL.find((n) => n.id === l)?.title).join(" / ")}
          </p>
        )}
      </div>
    </div>
  );
}
