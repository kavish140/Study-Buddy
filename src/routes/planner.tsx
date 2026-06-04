import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, Trash2 } from "lucide-react";
import { uid, type PlanItem, type Subject } from "@/lib/storage";
import { generatePlan } from "@/lib/ai.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Planner — AcePrep" },
      { name: "description", content: "AI-built multi-day study schedule based on the topics you need to cover." },
    ],
  }),
  component: PlannerPage,
});

function dayKey(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function PlannerPage() {
  const queryClient = useQueryClient();
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: api.getSubjects });
  const { data: plan = [] } = useQuery({ queryKey: ["plan"], queryFn: api.getPlan });

  const saveMutation = useMutation({
    mutationFn: api.savePlanItems,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plan"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, done }: { id: string, done: boolean }) => api.updatePlanItem(id, done),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plan"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deletePlanItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plan"] }),
  });
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [manualDate, setManualDate] = useState(dayKey(0));
  const [manualTask, setManualTask] = useState("");

  const pendingTopics = useMemo(
    () => subjects.flatMap((s) => s.topics.filter((t) => !t.done).map((t) => `${s.name}: ${t.name}`)),
    [subjects],
  );

  const handleGenerate = async () => {
    const topics = pendingTopics.length ? pendingTopics : subjects.flatMap((s) => s.topics.map((t) => `${s.name}: ${t.name}`));
    if (topics.length === 0) {
      toast.error("Add subjects & topics first on the Syllabus page.");
      return;
    }
    setLoading(true);
    try {
      const res = await generatePlan({ data: { topics: topics.slice(0, 40), days: Number(days) } });
      const next: PlanItem[] = res.plan.flatMap((d) =>
        d.tasks.map((t) => ({ id: uid(), date: dayKey(d.day - 1), task: t, done: false })),
      );
      await saveMutation.mutateAsync(next);
      toast.success(`Plan ready: ${next.length} tasks across ${res.plan.length} days`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    const p = plan.find((x) => x.id === id);
    if (p) updateMutation.mutate({ id, done: !p.done });
  };
  const remove = (id: string) => deleteMutation.mutate(id);
  const addManual = () => {
    if (!manualTask.trim()) return;
    saveMutation.mutate([{ id: uid(), date: manualDate, task: manualTask.trim(), done: false }]);
    setManualTask("");
  };

  const byDay = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    [...plan]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((p) => {
        const arr = map.get(p.date) ?? [];
        arr.push(p);
        map.set(p.date, arr);
      });
    return Array.from(map.entries());
  }, [plan]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight font-heading">Study planner</h1>
      <p className="text-muted-foreground mt-1">Generate a schedule from your syllabus or build one yourself.</p>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="p-5 rounded-2xl glass-card">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4 text-primary" /> AI plan generator
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            {pendingTopics.length
              ? `Using ${pendingTopics.length} unfinished topics from your syllabus.`
              : "No syllabus yet — add topics on the Syllabus page."}
          </div>
          <div className="flex gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10, 14, 21].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={loading} className="flex-1 bg-gradient-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate plan"}
            </Button>
          </div>
        </div>
        <div className="p-5 rounded-2xl glass-card">
          <div className="text-sm font-medium mb-3">Add task manually</div>
          <div className="flex gap-2">
            <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="w-44" />
            <Input
              value={manualTask}
              onChange={(e) => setManualTask(e.target.value)}
              placeholder="Task…"
              onKeyDown={(e) => e.key === "Enter" && addManual()}
            />
            <Button variant="secondary" onClick={addManual}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {byDay.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
            No tasks scheduled.
          </div>
        ) : (
          byDay.map(([date, items]) => {
            const d = new Date(date + "T00:00:00");
            const label = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
            const isToday = date === dayKey(0);
            return (
              <div key={date} className="p-5 rounded-2xl glass-card">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{label}</div>
                  {isToday && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">Today</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{items.filter((i) => i.done).length}/{items.length}</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {items.map((it) => (
                    <label key={it.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 group">
                      <Checkbox checked={it.done} onCheckedChange={() => toggle(it.id)} />
                      <span className={it.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{it.task}</span>
                      <button onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
