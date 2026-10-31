import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Backup = {
  id: string;
  email: string;
  row_counts: Record<string, number>;
  erased_at: string | null;
  wait_seconds?: number;
};

async function request<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "Study reset setup is missing. Apply database migration 008."
        : error.message,
    );
  return data as T;
}

export function AdminStudyReset({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Study data…
      </Button>
      {open && <StudyDataDialog userId={userId} email={email} close={() => setOpen(false)} />}
    </>
  );
}

function StudyDataDialog({
  userId,
  email,
  close,
}: {
  userId: string;
  email: string;
  close: () => void;
}) {
  const client = useQueryClient();
  const [ticket, setTicket] = useState<Backup | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [readyAt, setReadyAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const status = useQuery({
    queryKey: ["admin", "study-backup", userId],
    queryFn: () => request<Backup | null>("admin_study_backup_status", { p_user_id: userId }),
    retry: false,
    staleTime: 0,
  });
  const prepare = useMutation({
    mutationFn: () => request<Backup>("admin_prepare_study_reset", { p_user_id: userId }),
    onSuccess: (data) => {
      setTicket(data);
      setConfirmation("");
      setAcknowledged(false);
      setReadyAt(Date.now() + (data.wait_seconds ?? 10) * 1000);
      setSecondsLeft(data.wait_seconds ?? 10);
    },
  });
  useEffect(() => {
    if (!readyAt) return;
    const timer = window.setInterval(
      () => setSecondsLeft(Math.max(0, Math.ceil((readyAt - Date.now()) / 1000))),
      250,
    );
    return () => window.clearInterval(timer);
  }, [readyAt]);
  const backup = status.data;
  const restoring = !!backup;
  const current = backup ?? ticket;
  const phrase = `${restoring ? "RESTORE" : "ERASE"} ${current?.email ?? email}`;
  const change = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Review study data first.");
      if (restoring)
        await request("admin_restore_study_data", {
          p_backup_id: current.id,
          p_confirmation: confirmation,
        });
      else
        await request("admin_erase_study_data", {
          p_backup_id: current.id,
          p_confirmation: confirmation,
          p_acknowledged: acknowledged,
        });
    },
    onSuccess: () => {
      toast.success(
        restoring
          ? "Study data restored. New records have been retained."
          : "Study data cleared. A backup is available under this user's Study data control.",
      );
      void client.invalidateQueries();
      close();
    },
  });
  const busy = prepare.isPending || change.isPending;
  const total = Object.values(current?.row_counts ?? {}).reduce((sum, count) => sum + count, 0);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{restoring ? "Restore study data" : "Erase all study data"}</DialogTitle>
          <DialogDescription>
            {email}
            <br />
            User ID: {userId}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {restoring
            ? "Restore the saved backup alongside newer study work. If records conflict, the entire restore stops and the backup stays available. No current records will be overwritten."
            : "Clear saved subjects, quizzes, mock tests, notes, plans, flashcards, focus sessions, performance, chats, XP, saved questions, and question history. The account, profile settings, and community posts stay intact."}
        </p>
        {!restoring && (
          <p className="text-sm rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            A private database backup is saved before any records are removed. Restore is available
            here until used; the backup has no automatic expiry. Open study sessions may save new
            work after the reset.
          </p>
        )}
        {status.isPending && <p role="status">Checking for a recoverable backup…</p>}
        {status.error && (
          <div role="alert" className="text-sm text-destructive">
            {status.error.message}
            <Button variant="outline" onClick={() => void status.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {restoring && (
          <p className="text-sm">Backup saved: {new Date(backup.erased_at!).toLocaleString()}</p>
        )}
        {current && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-semibold mb-2">
              {total.toLocaleString()} records {restoring ? "in backup" : "to clear"}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-40 overflow-y-auto">
              {Object.entries(current.row_counts).map(([table, count]) => (
                <div key={table} className="flex justify-between gap-2 col-span-2">
                  <dt className="capitalize">{table.replaceAll("_", " ")}</dt>
                  <dd>{count.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {!current && status.isSuccess && !status.data && (
          <Button variant="outline" disabled={busy} onClick={() => prepare.mutate()}>
            {prepare.isPending ? "Preparing preview…" : "Review records to erase"}
          </Button>
        )}
        {current && (
          <>
            {!restoring && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acknowledged}
                  disabled={busy}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  I have checked the email and user ID, and understand this clears all saved study
                  work.
                </span>
              </label>
            )}
            <label className="space-y-2 text-sm">
              <span className="block">
                Type <strong className="break-all select-none">{phrase}</strong> to confirm.
              </span>
              <Input
                aria-label="Study data confirmation"
                autoComplete="off"
                spellCheck={false}
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {!restoring && (
              <p className="text-xs text-muted-foreground" role="status">
                {secondsLeft > 0
                  ? `Review carefully. Erase unlocks in ${secondsLeft}s.`
                  : "Review complete. This request expires after 15 minutes."}
              </p>
            )}
          </>
        )}
        {(prepare.error || change.error) && (
          <p role="alert" className="text-sm text-destructive">
            {(prepare.error ?? change.error)?.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={close}>
            Cancel
          </Button>
          {current && (
            <Button
              variant={restoring ? "default" : "destructive"}
              disabled={
                busy ||
                confirmation !== phrase ||
                (!restoring && (!acknowledged || secondsLeft > 0 || total === 0))
              }
              onClick={() => change.mutate()}
            >
              {change.isPending
                ? "Saving…"
                : restoring
                  ? "Restore backup"
                  : "Back up & erase study data"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
