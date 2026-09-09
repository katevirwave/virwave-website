import { createFileRoute } from "@tanstack/react-router";
import logoAsset from "@/assets/aikei-logo.png.asset.json";

export const Route = createFileRoute("/london")({
  head: () => ({
    meta: [
      { title: "AIKEI in London" },
      {
        name: "description",
        content:
          "In this great experiment of AI, we're pioneering the solution that brings humanity back into the conversation.",
      },
      // Scan-only landing page: it should not compete with the homepage in search.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "AIKEI in London" },
      {
        property: "og:description",
        content:
          "In this great experiment of AI, we're pioneering the solution that brings humanity back into the conversation.",
      },
    ],
  }),
  component: London,
});

/**
 * Kate's two booking schedules. Customers and partners share one — both
 * conversations start from the same place, a product and what testing it
 * would involve. Investors have their own.
 *
 * Canonical form, without the /u/0/ that Google's own share link carries:
 * that segment means "first signed-in account" and can land a visitor with
 * several Google accounts in the wrong one. Google redirects to this anyway.
 */
const BOOK_CUSTOMER =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ2P-1cukmh9S_2UzGVHoHvWDGndyP8FMBhm3ZZQ76PrZSTKZ7PYP2s9Ir5y4SxWp2AxaE5rU51C";

const BOOK_INVESTOR =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0KS0BXMUn3EQlVYisWwS5Lc1p1rvydxXJ3cV53GbP79_BeurQRr7KaD-Z31woTtp-O20KOpAw_";

/** Booking opens in its own tab so the page survives behind it. */
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

const btnPrimary =
  "cut-hover inline-block border border-teal bg-teal px-6 py-3 text-[15px] text-paper no-underline";
const btnSecondary =
  "cut-hover inline-block border border-line-strong px-6 py-3 text-[15px] text-ink no-underline";

/**
 * One statement and a way to book. Everything a scanner needs sits in a single
 * screen, so this is a full-height column with the quote optically centred
 * rather than a stack of sections to scroll.
 */
function London() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="px-6 py-6">
        <a href="/" className="inline-flex items-center">
          <img
            src={logoAsset.url}
            alt="AIKEI"
            className="logo-img h-9 w-auto"
            width="36"
            height="36"
          />
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center px-6 py-16 text-center">
        <p className="mx-auto max-w-[22ch] font-display text-[32px] font-medium leading-[1.06] tracking-[-0.03em] text-ink md:text-[56px]">
          In this great experiment of AI, we're pioneering the solution that brings{" "}
          <span className="text-muted">humanity back into the conversation</span>.
        </p>

        <p className="eyebrow mt-14">Book time with Kate</p>
        <div className="mt-5 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a href={BOOK_CUSTOMER} {...external} className={btnPrimary}>
            Customers &amp; partners
          </a>
          <a href={BOOK_INVESTOR} {...external} className={btnSecondary}>
            Investors
          </a>
        </div>
      </main>
    </div>
  );
}
