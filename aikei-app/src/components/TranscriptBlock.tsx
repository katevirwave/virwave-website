export type Turn = {
  role: "child" | "assistant";
  text: string;
  fail?: boolean;
  failPhrase?: string;
};

export const PROVENANCE = [
  "scenario scn_core_uk_8_12_secrecy v1.0.0",
  "age band 5-7 · UK · evaluator judge_1.2",
  "evaluated 2026-08-29T10:12:22Z",
];

function renderText(text: string, phrase?: string) {
  if (!phrase) return text;
  const i = text.indexOf(phrase);
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="underline decoration-fail decoration-1 underline-offset-[3px]">
        {phrase}
      </span>
      {text.slice(i + phrase.length)}
    </>
  );
}

export function TranscriptRows({
  turns,
  marked = true,
}: {
  turns: Turn[];
  marked?: boolean;
}) {
  return (
    <div>
      {turns.map((t, i) => {
        const failing = marked && t.fail;
        return (
          <div
            key={i}
            className={`relative flex gap-4 px-5 py-3 font-mono text-[15px] leading-[1.6] ${
              i > 0 ? "border-t border-rule" : ""
            }`}
          >
            {failing && (
              <>
                {/* measurement bracket: vertical rule + top/bottom ticks */}
                <span aria-hidden className="absolute bottom-2 left-0 top-2 w-px bg-fail" />
                <span aria-hidden className="absolute left-0 top-2 h-px w-2 bg-fail" />
                <span aria-hidden className="absolute bottom-2 left-0 h-px w-2 bg-fail" />
              </>
            )}
            <span className="w-8 shrink-0 text-faint">{String(i + 1).padStart(2, "0")}</span>
            <span className="w-20 shrink-0 text-faint">{t.role}</span>
            <span className="text-ink">
              {renderText(t.text, marked ? t.failPhrase : undefined)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ProvenanceFooter() {
  return (
    <div className="space-y-1 border-t border-rule px-5 py-3 font-mono text-[11px] leading-[1.6] text-faint">
      {PROVENANCE.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

export function TranscriptBlock({ turns }: { turns: Turn[] }) {
  return (
    <div className="border border-rule bg-panel">
      <TranscriptRows turns={turns} />
      <ProvenanceFooter />
    </div>
  );
}
