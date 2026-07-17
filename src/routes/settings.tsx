import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Settings, Save, Moon, Sun, Monitor, User as UserIcon, Calendar, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EXAM_CATALOG } from "@/lib/exam-catalog";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · AcePrep" },
      { name: "description", content: "Manage your AcePrep preferences" },
    ],
  }),
  component: SettingsPage,
});

const AVATAR_EMOJIS = ["🎓", "🚀", "💡", "🧠", "🦊", "🦁", "🐼", "🦄", "🎯", "⚡"];

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: api.getUserProfile,
  });

  const [examId, setExamId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [avatar, setAvatar] = useState("🎓");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setExamId(profile.exam_id);
      setTargetDate(profile.target_date || "");
    }
    if (user?.user_metadata?.avatar_emoji) {
      setAvatar(user.user_metadata.avatar_emoji);
    }
  }, [profile, user]);

  const saveMutation = useMutation({
    mutationFn: api.saveUserProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success("Settings saved successfully!");
    },
    onError: (e) => toast.error(e.message || "Failed to save settings"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedExam = EXAM_CATALOG.find((e) => e.id === examId);
      // 1. Save profile
      await saveMutation.mutateAsync({
        exam_id: examId,
        exam_name: selectedExam?.name || examId.toUpperCase(),
        target_date: targetDate || null,
        selected_subjects: selectedExam ? selectedExam.subjects.map(s => s.name) : [],
      });
      // 2. Save avatar emoji to Auth Metadata
      if (user?.user_metadata?.avatar_emoji !== avatar) {
        await supabase.auth.updateUser({
          data: { avatar_emoji: avatar },
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto animate-fade-up">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-4 text-primary shadow-glow-sm">
          <Settings className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold font-heading">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and app preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="card-light rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <UserIcon className="h-5 w-5 text-primary" /> Profile
          </h2>
          
          <div className="space-y-4">
            {/* Avatar Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Avatar</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setAvatar(emoji)}
                    className={`h-12 w-12 text-2xl flex items-center justify-center rounded-full transition-all duration-200 ${
                      avatar === emoji
                        ? "bg-primary/20 ring-2 ring-primary scale-110"
                        : "bg-muted hover:bg-accent"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Exam Selection */}
            <div>
              <label className="block text-sm font-medium mb-1">Target Exam</label>
              <select
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                disabled={isProfileLoading}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors"
              >
                <option value="" disabled>Select an exam</option>
                {EXAM_CATALOG.map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.name}</option>
                ))}
              </select>
            </div>
            
            {/* Target Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={isProfileLoading}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="card-light rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Monitor className="h-5 w-5 text-primary" /> Preferences
          </h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                <Sun className="h-5 w-5" />
                <span className="text-xs font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                <Moon className="h-5 w-5" />
                <span className="text-xs font-medium">Dark</span>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === "system" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                <Monitor className="h-5 w-5" />
                <span className="text-xs font-medium">System</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSave} disabled={saving || isProfileLoading} className="bg-gradient-primary gap-2 min-w-[120px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
