import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { EXAM_CATALOG } from "@/lib/exam-catalog";
import { toast } from "sonner";
import {
  User,
  GraduationCap,
  Bell,
  Palette,
  ShieldAlert,
  Save,
  LogOut,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Check,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · AcePrep" },
      { name: "description", content: "Manage your AcePrep profile, exam preferences and theme" },
    ],
  }),
  component: SettingsPage,
});

/* ─── Avatar options ─────────────────────────────────────────────────────── */
const AVATAR_EMOJIS = ["🎓", "🧠", "📚", "🚀", "⭐", "🔥", "💡", "🏆", "⚡", "🎯", "🦁", "🐉"];

/* ─── Section wrapper ────────────────────────────────────────────────────── */
function Section({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-light rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="h-8 w-8 rounded-lg grid place-items-center"
          style={{ background: `${color}20`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

/* ─── Field wrapper ──────────────────────────────────────────────────────── */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: api.getUserProfile,
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: api.saveUserProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success("Settings saved!");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  /* ── Local form state ── */
  const [displayName, setDisplayName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("🎓");
  const [examId, setExamId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  // Sync form with loaded profile
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name || "");
    setAvatarEmoji(profile.avatar_emoji || "🎓");
    setExamId(profile.exam_id || "");
    setTargetDate(profile.target_date || "");
  }, [profile]);

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
      setNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  /* ── Handlers ── */
  const handleSaveProfile = () => {
    if (!profile) return;
    const selectedExam = EXAM_CATALOG.find((e) => e.id === examId);
    saveMutation.mutate({
      ...profile,
      display_name: displayName.trim() || undefined,
      avatar_emoji: avatarEmoji,
      exam_id: examId,
      exam_name: selectedExam?.name ?? profile.exam_name,
      target_date: targetDate || null,
    });
  };

  const handleNotifToggle = async () => {
    if (!("Notification" in window)) {
      toast.error("Your browser doesn't support notifications");
      return;
    }
    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked — please enable them in your browser settings");
      return;
    }
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      setNotifEnabled(result === "granted");
      if (result === "granted") {
        new Notification("AcePrep", { body: "Daily reminders enabled! 🎓" });
        toast.success("Notifications enabled!");
      }
    } else {
      // Already granted — toggle the local preference (browser can't revoke programmatically)
      setNotifEnabled((prev) => !prev);
      toast.info("Toggle your browser site settings to fully disable notifications");
    }
  };

  const handleClearData = () => {
    if (
      !confirm(
        "This will clear all your local quiz and study data stored in this browser. Your account data in the cloud will NOT be deleted. Continue?",
      )
    )
      return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("aceprep")) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    toast.success("Local data cleared");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch {
      toast.error("Failed to sign out");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow-sm">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Settings</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Profile ── */}
        <Section icon={User} title="Profile" color="#8b5cf6">
          {/* Avatar picker */}
          <Field label="Avatar">
            <div className="flex flex-wrap gap-2 mt-1">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setAvatarEmoji(emoji)}
                  className={cn(
                    "h-10 w-10 rounded-xl text-xl transition-all duration-150 hover:scale-110",
                    avatarEmoji === emoji
                      ? "ring-2 ring-primary scale-110"
                      : "opacity-60 hover:opacity-100",
                  )}
                  style={{ background: "var(--muted)" }}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </Field>

          {/* Display name */}
          <Field
            label="Display Name"
            hint="This name appears on the leaderboard and in the sidebar. Leave blank to use your email."
          >
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Kavish"
              maxLength={32}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-border"
              style={{ background: "var(--muted)" }}
            />
          </Field>

          <Button
            onClick={handleSaveProfile}
            disabled={saveMutation.isPending}
            className="bg-gradient-primary gap-2 w-full sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save Profile"}
          </Button>
        </Section>

        {/* ── Exam ── */}
        <Section icon={GraduationCap} title="Exam & Target" color="#0ea5e9">
          <Field label="Exam">
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-border text-foreground appearance-none cursor-pointer"
              style={{ background: "var(--muted)" }}
            >
              {EXAM_CATALOG.map((e) => (
                <option key={e.id} value={e.id} className="bg-background text-foreground">
                  {e.icon} {e.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Target Date"
            hint="The date of your exam. Used for the countdown timer on the Dashboard."
          >
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-border"
              style={{ background: "var(--muted)", colorScheme: "dark" }}
            />
          </Field>

          <Button
            onClick={handleSaveProfile}
            disabled={saveMutation.isPending}
            className="bg-gradient-primary gap-2 w-full sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save Exam Settings"}
          </Button>
        </Section>

        {/* ── Theme ── */}
        <Section icon={Palette} title="Theme" color="#f59e0b">
          <Field label="Appearance">
            <div className="flex gap-2">
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all",
                    theme === value
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  style={
                    theme === value
                      ? { background: "var(--accent)" }
                      : { background: "var(--muted)" }
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {theme === value && <Check className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* ── Notifications ── */}
        <Section icon={Bell} title="Notifications" color="#10b981">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Daily study reminders</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {notifPermission === "denied"
                  ? "Blocked by browser — enable in site settings"
                  : notifEnabled
                    ? "Reminders are enabled"
                    : "Get a daily nudge to keep your streak going"}
              </div>
            </div>
            <button
              onClick={handleNotifToggle}
              disabled={notifPermission === "denied"}
              className={cn(
                "relative h-6 w-11 rounded-full transition-all duration-300 shrink-0",
                notifEnabled ? "bg-primary" : "bg-muted-foreground/30",
                notifPermission === "denied" && "opacity-40 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300",
                  notifEnabled ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>
        </Section>

        {/* ── Danger Zone ── */}
        <Section icon={ShieldAlert} title="Danger Zone" color="#ef4444">
          <div className="space-y-3">
            {/* Clear local data */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <div>
                <div className="text-sm font-medium">Clear local data</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Removes locally-stored timer, UI preferences. Cloud data is safe.
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleClearData}
                className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10 shrink-0 ml-4"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>

            {/* Sign out */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div>
                <div className="text-sm font-medium">Sign out</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Sign out of your account on this device
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOut} className="gap-2 shrink-0 ml-4">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
