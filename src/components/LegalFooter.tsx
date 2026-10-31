export function LegalFooter() {
  return (
    <footer className="border-t border-border px-4 py-5 text-xs text-muted-foreground">
      <nav
        aria-label="Legal"
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
      >
        <span>AcePrep</span>
        <a className="hover:text-foreground underline" href="/privacy">
          Privacy Policy
        </a>
        <a className="hover:text-foreground underline" href="/terms">
          Terms & Conditions
        </a>
        <a className="hover:text-foreground underline" href="/sources">
          Sources & Licenses
        </a>
      </nav>
    </footer>
  );
}
