import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AcePrep" },
      {
        name: "description",
        content:
          "How AcePrep handles account information, study data, AI requests and browser storage.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>Information we process</h2>
        <p>
          AcePrep processes information to provide your account, study tools and progress tracking:
        </p>
        <ul>
          <li>
            Account information received through Google sign-in, including your user identifier,
            email and available profile details.
          </li>
          <li>
            Your exam profile, target date, subjects, syllabus progress, plans, notes, review cards,
            saved chats, quiz and mock-test attempts, answers, scores, focus sessions, streaks and
            activity statistics.
          </li>
          <li>
            Text, images or PDFs you submit to AI features, and the responses you choose to save.
          </li>
          <li>
            Community posts, replies and votes. Community contributions are shared with other users
            through those features; leaderboard views can display your name and progress statistics.
          </li>
          <li>
            Technical information needed to deliver and troubleshoot the service, such as requests,
            error details and the page where an error occurs. Hosting and service providers may keep
            their own operational logs.
          </li>
        </ul>
      </section>
      <section>
        <h2>How information is used and shared</h2>
        <p>
          We use your information to sign you in, store and synchronize study work, track progress,
          select unseen practice questions, personalize study assistance and maintain the service.
        </p>
        <p>
          Supabase provides account authentication, database storage and server functions. Google
          provides sign-in. AI requests are processed through Groq for text features and Google
          Gemini for image and PDF assistance in the current implementation. When you use AI tools,
          your request and relevant study context can be sent to these providers. That context can
          include your display name, exam and target date, syllabus progress, today's tasks, XP and
          streak. Avoid submitting sensitive personal information that is unnecessary for studying.
        </p>
        <p>
          Providers process requests under their own applicable terms and privacy practices.
          Processing may take place outside your country. This policy does not promise that
          providers retain no data or exclude requests from every form of model improvement.
        </p>
        <p>
          The site loads fonts from Google Fonts, which creates requests to Google. When the
          optional error-reporting integration is present, it can receive error information and the
          page path. Information may also be disclosed when needed to comply with applicable legal
          obligations or address abuse and security issues.
        </p>
      </section>
      <section>
        <h2>Cookies and browser storage</h2>
      <p>When you paste an image or click the clipboard button in AI Tutor, the app reads the image you choose to paste and prepares a local preview. It does not read the clipboard on page load. The image is sent for AI processing when you send the message.</p>
        <p>
          AcePrep uses browser storage for sign-in sessions, theme and interface preferences, timers
          and locally stored study state. The current app does not implement advertising cookies.
          Third-party sign-in and external resource sites may use their own cookies and storage.
        </p>
        <p>
          You can sign out, clear site data or restrict storage through your browser. Doing so may
          remove local preferences and interrupt sign-in. Clearing local study data in Settings does
          not delete cloud account data, saved attempts or community content. Resetting question
          history only changes which questions may be selected again.
        </p>
      </section>
      <section>
        <h2>Retention and your choices</h2>
        <p>
          Saved account and study records remain in the service until removed through available
          controls or handled through a request to the operator, subject to operational and legal
          needs. There is currently no fixed automatic retention schedule or self-service
          full-account deletion feature. Provider logs and backups follow the relevant provider's
          retention practices and may remain after active records are removed.
        </p>
        <p>
          You can edit your profile and delete individual study records where the app offers those
          controls. Email the contact below to request access, correction, export or deletion of
          account information, or to raise a privacy concern. We may need to verify that a request
          comes from the account holder. Requests will be handled subject to applicable law and
          technical limitations; we do not promise an automated export or immediate backup erasure.
        </p>
      </section>
      <section>
        <h2>Students and younger users</h2>
        <p>
          If you are under 18, involve a parent or guardian in reviewing the service and this
          policy. The current app does not implement age verification or a verified parental-consent
          workflow. A parent or guardian can contact the operator about a child's information. Where
          applicable law requires verified consent before a child's data is processed, the service
          should not be used without that requirement being met.
        </p>
      </section>
      <section>
        <h2>Security, external sites and changes</h2>
        <p>
          We use the account and access controls implemented in the app and its service providers,
          but no online service can guarantee complete security. External links open services with
          their own policies. Material changes to this policy will be reflected here with an updated
          date; additional notice or consent will be provided where required.
        </p>
      </section>
    </LegalPage>
  );
}
