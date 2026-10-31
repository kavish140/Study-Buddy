import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Study Buddy" },
      {
        name: "description",
        content:
          "Terms for using Study Buddy, including accounts, acceptable use, educational limitations and content rights.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <section>
        <h2>Using Study Buddy</h2>
        <p>
          These terms govern your use of Study Buddy and its study tools. Use the service only if you
          can accept these terms under the laws that apply to you. If you are under 18, review them
          with your parent or guardian and obtain any permission required by applicable law. If you
          do not agree, do not use the service.
        </p>
        <p>
          Our <a href="/privacy">Privacy Policy</a> explains how information is handled. The{" "}
          <a href="/sources">Sources & Licenses</a> page identifies third-party materials and their
          applicable notices.
        </p>
      </section>
      <section>
        <h2>Accounts and acceptable use</h2>
        <p>
          Keep your sign-in account secure and provide accurate profile information. You are
          responsible for activity you authorize through your account. Let the operator know if you
          suspect unauthorized access.
        </p>
        <ul>
          <li>
            Do not use Study Buddy to cheat in a live examination or violate an exam provider's rules.
          </li>
          <li>
            Do not harass others, post unlawful material, disclose someone else's private
            information or upload material you do not have permission to use.
          </li>
          <li>
            Do not bypass access controls, disrupt the service, misuse automated requests or attempt
            to access another user's records.
          </li>
          <li>
            Respect the licenses and restrictions attached to third-party materials. Access to a
            question does not transfer ownership or unrestricted redistribution rights.
          </li>
        </ul>
      </section>
      <section>
        <h2>Educational and AI limitations</h2>
        <p>
          Study Buddy is an independent study aid. It does not guarantee marks, ranks, selection,
          admission or any educational outcome. Exam names and trademarks belong to their respective
          owners; their appearance does not imply affiliation, sponsorship or endorsement.
        </p>
        <p>
          AI explanations, summaries, plans and image solutions may be inaccurate or incomplete.
          Check important answers and exam rules against official materials. Practice questions can
          come from past papers, while current syllabuses, patterns and answer keys may differ.
          In-app practice does not necessarily reproduce an official paper or its scoring rules.
        </p>
        <p>
          Question imports preserve available source answer keys and exclude some incomplete or
          unsupported items. A source's inclusion does not guarantee every transcription or answer
          is error-free. Report suspected errors to the operator.
        </p>
      </section>
      <section>
        <h2>Your content and community contributions</h2>
        <p>
          You retain rights you hold in material you submit. You give the operator permission to
          store, process and display that material as needed to provide the features you use,
          including processing AI requests through service providers. Posting in community features
          makes that content available to others through those features. Only share content you are
          comfortable making available in that context.
        </p>
        <p>
          Content or accounts may be restricted or removed to address misuse, rights complaints,
          security issues or legal obligations. You may stop using the service at any time; contact
          the operator for account deletion requests.
        </p>
      </section>
      <section>
        <h2>Availability, external services and responsibility</h2>
        <p>
          Features depend on hosting, authentication, AI and other external services. Availability,
          limits and functionality may change. Keep your own copies of important study work.
          External resources operate under their own terms and may require accounts or payment.
        </p>
        <p>
          To the extent permitted by applicable law, the service is provided as available without a
          guarantee of uninterrupted operation, accuracy or fitness for a particular purpose. The
          operator is not responsible for indirect losses arising from reliance on study outputs or
          service interruptions, except where responsibility cannot lawfully be excluded. These
          terms do not limit mandatory consumer rights or liability that applicable law does not
          allow us to limit.
        </p>
      </section>
      <section>
        <h2>Changes and concerns</h2>
        <p>
          Updates to these terms will appear here with a revised date. Material changes will receive
          additional notice where required. Contact the operator below about service disputes,
          content issues or these terms.
        </p>
      </section>
    </LegalPage>
  );
}
