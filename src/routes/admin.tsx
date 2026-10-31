import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ShieldCheck,
  RefreshCw,
  Download,
  Users,
  Activity,
  BookOpen,
  CheckCircle2,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAIL, csvExport, hasAdminEmail } from "@/lib/admin-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminStudyReset } from "@/components/AdminStudyReset";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin · Study Buddy" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

type Row = Record<string, unknown>;
type Page = { rows: Row[]; total: number };
type Overview = {
  counts: Record<string, number | null>;
  users: number;
  recent_signins: number;
  onboarded: number;
  signups: { day: string; count: number }[];
  exams: { name: string; count: number }[];
  performance: { questions: number; correct: number };
  generated_at: string;
};

async function rpc<T>(name: string, args = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === "PGRST202")
      throw new Error(
        "Admin database setup is missing. Apply supabase/migrations/007_admin_dashboard.sql, then retry.",
      );
    throw new Error(error.message);
  }
  return data as T;
}

const label = (name: string) => name.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const formatDate = (value: unknown) => (value ? new Date(String(value)).toLocaleString() : "Never");

function ErrorNotice({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-3"
    >
      <p>{error.message}</p>
      <Button variant="outline" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}

function AdminPage() {
  const { user, loading, error, retry } = useAuth();
  if (loading)
    return (
      <p className="p-8" role="status">
        Checking administrator access…
      </p>
    );
  if (error)
    return (
      <div className="p-8">
        <ErrorNotice error={new Error(error)} retry={retry} />
      </div>
    );
  if (!user)
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold">Administrator sign-in</h1>
        <p>Sign in with the administrator account to continue.</p>
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  if (!hasAdminEmail(user.email))
    return (
      <div className="p-8 space-y-3">
        <ShieldCheck className="text-muted-foreground" />
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p className="text-muted-foreground">Your account does not have administrator access.</p>
        <Button variant="outline" asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  return <AdminAuthorization key={user.id} userId={user.id} />;
}

function AdminAuthorization({ userId }: { userId: string }) {
  const access = useQuery({
    queryKey: ["admin", userId, "access"],
    queryFn: () => rpc<boolean>("is_app_admin"),
    retry: false,
    staleTime: 0,
  });
  if (access.isPending)
    return (
      <p className="p-8" role="status">
        Verifying administrator permissions…
      </p>
    );
  if (access.error)
    return (
      <div className="p-8">
        <ErrorNotice error={access.error} retry={() => void access.refetch()} />
      </div>
    );
  if (!access.data)
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p>A confirmed administrator account is required.</p>
      </div>
    );
  return <AdminDashboard userId={userId} />;
}

function AdminDashboard({ userId }: { userId: string }) {
  const client = useQueryClient();
  const [tab, setTab] = useState("overview");
  const overview = useQuery({
    queryKey: ["admin", userId, "overview"],
    queryFn: () => rpc<Overview>("admin_overview"),
    retry: false,
  });
  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm font-semibold mb-2">
            <ShieldCheck size={18} /> ADMINISTRATION
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Control center</h1>
          <p className="text-sm text-muted-foreground mt-2">Manage Study Buddy · {ADMIN_EMAIL}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" asChild>
            <Link to="/">Back to app</Link>
          </Button>
          <Button
            variant="outline"
            disabled={overview.isFetching}
            onClick={() => void client.invalidateQueries({ queryKey: ["admin", userId] })}
          >
            <RefreshCw size={16} className={overview.isFetching ? "animate-spin" : ""} /> Refresh
            data
          </Button>
        </div>
      </div>
      <div
        className="flex gap-2 border-b pb-3 overflow-x-auto"
        role="tablist"
        aria-label="Admin sections"
      >
        {["overview", "users", "records", "audit"].map((name) => (
          <Button
            key={name}
            role="tab"
            aria-selected={tab === name}
            variant={tab === name ? "default" : "ghost"}
            onClick={() => setTab(name)}
          >
            {label(name)}
          </Button>
        ))}
      </div>
      {overview.error && (
        <ErrorNotice error={overview.error} retry={() => void overview.refetch()} />
      )}
      {tab === "overview" &&
        (overview.isPending ? (
          <p role="status">Loading platform analytics…</p>
        ) : (
          overview.data && <Analytics data={overview.data} />
        ))}
      {tab === "users" && (
        <DataManager key="users" userId={userId} mode="users" counts={overview.data?.counts} />
      )}
      {tab === "records" && (
        <DataManager key="records" userId={userId} mode="records" counts={overview.data?.counts} />
      )}
      {tab === "audit" && (
        <DataManager key="audit" userId={userId} mode="audit" counts={overview.data?.counts} />
      )}
      {overview.data && (
        <p className="text-xs text-muted-foreground">
          Snapshot: {formatDate(overview.data.generated_at)}. Refresh to load the latest data.
        </p>
      )}
    </div>
  );
}

function Analytics({ data }: { data: Overview }) {
  const accuracy = data.performance.questions
    ? `${Math.round((data.performance.correct / data.performance.questions) * 100)}%`
    : "—";
  const cards = [
    {
      name: "Registered users",
      value: data.users,
      icon: Users,
      detail: `${data.onboarded} completed onboarding`,
    },
    {
      name: "Signed in · 7 days",
      value: data.recent_signins,
      icon: Activity,
      detail: "Based on latest authentication sign-in",
    },
    {
      name: "Questions attempted",
      value: data.performance.questions,
      icon: BookOpen,
      detail: "From saved topic performance logs",
    },
    {
      name: "Answer accuracy",
      value: accuracy,
      icon: CheckCircle2,
      detail: `${data.performance.correct.toLocaleString()} correct answers`,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ name, value, icon: Icon, detail }) => (
          <div key={name} className="rounded-2xl border bg-card p-5">
            <div className="flex justify-between text-muted-foreground text-sm">
              {name}
              <Icon size={18} />
            </div>
            <div className="text-3xl font-bold my-3">{value.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 min-w-0">
          <h2 className="font-semibold">New accounts · last 30 days</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-5">Daily registrations, UTC</p>
          <div className="h-60" aria-label="Daily account registrations">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.signups}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d: string) => d.slice(5)}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  minTickGap={25}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Bar
                  dataKey="count"
                  name="New accounts"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold mb-4">Exam distribution</h2>
          {!data.exams.length && (
            <p className="text-sm text-muted-foreground">No exam selections yet.</p>
          )}
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {data.exams.map((exam) => (
              <div key={exam.name}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{exam.name}</span>
                  <span className="text-muted-foreground">{exam.count} users</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${(exam.count / Math.max(1, data.users)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold mb-4">Platform inventory</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.counts)
            .filter(([key]) => key !== "admin_audit_log")
            .map(([key, count]) => (
              <div key={key} className="rounded-xl bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{label(key)}</div>
                <div className="text-xl font-semibold mt-2">
                  {count === null ? "Not installed" : count.toLocaleString()}
                </div>
              </div>
            ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Counts cover saved database records. The static imported question bank, AI costs, and page
          views are not tracked here.
        </p>
      </section>
    </div>
  );
}

function DataManager({
  userId,
  mode,
  counts,
}: {
  userId: string;
  mode: "users" | "records" | "audit";
  counts?: Overview["counts"];
}) {
  const client = useQueryClient();
  const [table, setTable] = useState(mode === "audit" ? "admin_audit_log" : "forum_posts");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<{ type: "delete" | "reset"; row: Row } | null>(null);
  const results = useQuery({
    queryKey: ["admin", userId, mode, table, search, page],
    queryFn: () =>
      mode === "users"
        ? rpc<Page>("admin_users", { p_search: search, p_page: page })
        : rpc<Page>("admin_records", { p_table: table, p_search: search, p_page: page }),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (action: NonNullable<typeof confirm>) => {
      if (action.type === "reset")
        await rpc("admin_reset_onboarding", { p_user_id: action.row.id });
      else await rpc("admin_delete_record", { p_table: table, p_id: String(action.row.id) });
    },
    onSuccess: () => {
      toast.success("Change saved and recorded in the audit log.");
      setConfirm(null);
      setSelected(null);
      void client.invalidateQueries({ queryKey: ["admin", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const download = () => {
    if (!results.data?.rows.length) return;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csvExport(results.data.rows)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `study-buddy-${mode === "users" ? "users" : table}-page-${page + 1}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const columns =
    mode === "users"
      ? ["email", "exam_name", "onboarding_completed", "created_at", "last_sign_in_at"]
      : mode === "audit"
        ? ["action", "target_table", "target_id", "actor_id", "created_at"]
        : ["id", "user_id", "summary"];
  const canDelete =
    mode === "records" && !["user_profiles", "user_stats", "admin_audit_log"].includes(table);
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {mode === "users"
            ? "User management"
            : mode === "audit"
              ? "Administrator activity"
              : "Records & moderation"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "users"
            ? "Find accounts, inspect exam selections, and restart onboarding."
            : mode === "audit"
              ? "A read-only history of changes made through the admin controls."
              : "Inspect saved content and remove individual records. Search matches any field, including a user ID."}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {mode === "records" && (
          <select
            aria-label="Record type"
            className="rounded-md border bg-background px-3 py-2 text-sm max-w-full"
            value={table}
            onChange={(e) => {
              setTable(e.target.value);
              setPage(0);
              setSearch("");
              setDraft("");
              setSelected(null);
            }}
          >
            {Object.entries(counts ?? { forum_posts: 0 })
              .filter(([name, count]) => name !== "admin_audit_log" && count !== null)
              .map(([name]) => (
                <option value={name} key={name}>
                  {label(name)}
                </option>
              ))}
          </select>
        )}
        <form
          className="flex flex-1 gap-2 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft);
            setPage(0);
          }}
        >
          <Input
            aria-label="Search admin records"
            placeholder={mode === "users" ? "Search email or exact user ID…" : "Search records…"}
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button variant="outline" aria-label="Search" type="submit">
            <Search size={16} />
          </Button>
        </form>
        <Button
          variant="outline"
          onClick={download}
          disabled={!results.data?.rows.length || results.isFetching}
        >
          <Download size={16} /> Export page
        </Button>
      </div>
      {results.error && <ErrorNotice error={results.error} retry={() => void results.refetch()} />}
      {results.isPending ? (
        <p role="status">Loading records…</p>
      ) : (
        results.data && (
          <>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="p-3 whitespace-nowrap font-medium">
                        {label(col)}
                      </th>
                    ))}
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.data.rows.map((row) => (
                    <tr key={String(row.id)} className="border-t">
                      {columns.map((col) => {
                        const value =
                          col === "summary"
                            ? (row.title ??
                              row.name ??
                              row.subject ??
                              row.topic ??
                              row.content ??
                              row.question ??
                              row.exam_name ??
                              "View full record")
                            : row[col];
                        return (
                          <td
                            key={col}
                            className="p-3 max-w-64 truncate"
                            title={String(value ?? "")}
                          >
                            {col.endsWith("_at")
                              ? formatDate(value)
                              : typeof value === "boolean"
                                ? value
                                  ? "Complete"
                                  : "Incomplete"
                                : String(value ?? "—")}
                          </td>
                        );
                      })}
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                            Inspect
                          </Button>
                          {mode === "users" && Boolean(row.onboarding_completed) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirm({ type: "reset", row })}
                            >
                              Reset onboarding
                            </Button>
                          )}
                          {mode === "users" && (
                            <AdminStudyReset userId={String(row.id)} email={String(row.email)} />
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="destructive"
                              aria-label={`Delete record ${row.id}`}
                              onClick={() => setConfirm({ type: "delete", row })}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!results.data.rows.length && (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No matching records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">
                {results.data.total.toLocaleString()} records · Page {page + 1} of{" "}
                {Math.max(1, Math.ceil(results.data.total / 25))}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0 || results.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * 25 >= results.data.total || results.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Exports contain the current page of up to 25 records. Profile and XP records are
              read-only. Deletions may remove linked records according to database constraints.
            </p>
          </>
        )
      )}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record details</DialogTitle>
            <DialogDescription>
              {mode === "users" ? "Account information" : label(table)}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => !open && !mutation.isPending && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.type === "reset" ? "Reset onboarding?" : "Delete this record?"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.type === "reset"
                ? `The user ${confirm.row.email} will be asked to complete onboarding again. Their saved study content is retained.`
                : `Permanently remove record ${confirm?.row.id} from ${label(table)}. Linked records may also be removed. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant={confirm?.type === "delete" ? "destructive" : "default"}
              disabled={mutation.isPending}
              onClick={() => confirm && mutation.mutate(confirm)}
            >
              {mutation.isPending ? "Saving…" : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
