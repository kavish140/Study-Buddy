import type { ReactNode } from "react";
import { LEGAL_UPDATED, OPERATOR_NAME, CONTACT_EMAIL } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground">
      <article className="mx-auto max-w-3xl space-y-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_p]:leading-relaxed [&_p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-2 [&_a]:text-primary [&_a]:underline">
        <a href="/landing" className="text-sm">
          ← AcePrep
        </a>
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LEGAL_UPDATED}</p>
        </header>
        {children}
        <section id="contact">
          <h2>Contact</h2>
          <p>
            AcePrep is operated by {OPERATOR_NAME}. For privacy requests, service questions or
            copyright concerns, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            Include enough information to identify the issue; never send your password or sign-in
            tokens.
          </p>
        </section>
      </article>
    </main>
  );
}
