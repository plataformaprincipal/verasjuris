export function BrandMark({ variant = "positive" }: { variant?: "positive" | "negative" }) {
  // Official master SVGs are not published yet (see public/brand/README.md).
  // Use the approved text treatment until authorized assets are available.
  return (
    <span className={`vj-brand-text${variant === "negative" ? " vj-brand-text-inverse" : ""}`}>
      VerasJuris
    </span>
  );
}
