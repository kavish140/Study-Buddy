import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, ChevronRight, ChevronLeft, Calendar, Sparkles, Check, Search, Loader2 } from "lucide-react";
import { EXAM_CATALOG, type ExamInfo } from "@/lib/exam-catalog";
import { api } from "@/lib/api";
import { uid, type Subject } from "@/lib/storage";
import { generatePlan } from "@/lib/ai.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get Started — AcePrep" },
      { name: "description", content: "Set up your AcePrep profile: pick your exam, select subjects, and let AI create your study plan." },
    ],
  }),
  component: OnboardingPage,
});

const SUBJECT_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#ef4444", "#14b8a6"];

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedExam, setSelectedExam] = useState<ExamInfo | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState("");
  const [loading, setLoading] = useState(false);

  const saveProfileMutation = useMutation({
    mutationFn: api.saveUserProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["userProfile"] }),
  });

  const saveSubjectMutation = useMutation({
    mutationFn: api.saveSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const filteredExams = search.trim()
    ? EXAM_CATALOG.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.shortName.toLowerCase().includes(search.toLowerCase()) ||
          e.description.toLowerCase().includes(search.toLowerCase()),
      )
    : EXAM_CATALOG;

  const handleExamSelect = (exam: ExamInfo) => {
    setSelectedExam(exam);
    setSelectedSubjects(exam.subjects.map((s) => s.name));
  };

  const toggleSubject = (name: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  const handleFinish = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      // 1. Save profile
      await saveProfileMutation.mutateAsync({
        exam_id: selectedExam.id,
        exam_name: selectedExam.name,
        target_date: targetDate || null,
        selected_subjects: selectedSubjects,
        onboarding_completed: true,
      });

      // 2. Create subjects from exam syllabus
      const examSubjects = selectedExam.subjects.filter((s) =>
        selectedSubjects.includes(s.name),
      );
      for (let i = 0; i < examSubjects.length; i++) {
        const es = examSubjects[i];
        const subject: Subject = {
          id: uid(),
          name: es.name,
          color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
          topics: es.topics.map((t) => ({ id: uid(), name: t, done: false })),
        };
        await saveSubjectMutation.mutateAsync(subject);
      }

      // 3. Generate initial plan if target date is set
      if (targetDate) {
        try {
          const topics = examSubjects
            .flatMap((s) => s.topics.map((t) => `${s.name}: ${t}`))
            .slice(0, 40);
          const daysUntil = Math.max(
            1,
            Math.ceil(
              (new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            ),
          );
          const planDays = Math.min(daysUntil, 14);
          const res = await generatePlan({ data: { topics, days: planDays } });
          const planItems = res.plan.flatMap((d: { day: number; tasks: string[] }) => {
            const date = new Date();
            date.setDate(date.getDate() + d.day - 1);
            return d.tasks.map((t: string) => ({
              id: uid(),
              date: date.toISOString().slice(0, 10),
              task: t,
              done: false,
            }));
          });
          if (planItems.length > 0) {
            await api.savePlanItems(planItems);
            queryClient.invalidateQueries({ queryKey: ["plan"] });
          }
        } catch {
          // Plan generation is optional, don't block onboarding
        }
      }

      toast.success("You're all set! Let's start studying.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const daysRemaining = targetDate
    ? Math.max(0, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/6 w-64 h-64 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/6 w-80 h-80 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-tight font-heading text-lg">AcePrep</div>
            <div className="text-xs text-muted-foreground">Let's set up your profile</div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {["Pick Exam", "Subjects", "Target Date"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold transition-all duration-300 ${
                  i < step
                    ? "bg-primary text-white"
                    : i === step
                      ? "bg-gradient-primary text-white shadow-glow-sm"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 0: Pick Exam */}
        {step === 0 && (
          <div>
            <h1 className="text-2xl font-bold font-heading mb-2">Which exam are you preparing for?</h1>
            <p className="text-muted-foreground mb-6">Choose your target exam and we'll load the official syllabus.</p>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exams..."
                className="pl-10"
              />
            </div>

            <div className="grid gap-3">
              {filteredExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => handleExamSelect(exam)}
                  className={`w-full text-left p-5 rounded-2xl transition-all duration-200 ${
                    selectedExam?.id === exam.id
                      ? "glass border-2 border-primary shadow-glow-sm"
                      : "glass-card"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-xl grid place-items-center text-2xl"
                      style={{ backgroundColor: exam.color + "15" }}
                    >
                      {exam.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-heading">{exam.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {exam.country}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">{exam.description}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{exam.subjects.length} subjects</span>
                        <span>·</span>
                        <span>{exam.subjects.reduce((s, x) => s + x.topics.length, 0)} topics</span>
                        <span>·</span>
                        <span>{exam.examPattern.totalTimeMinutes} min</span>
                      </div>
                    </div>
                    {selectedExam?.id === exam.id && (
                      <div className="h-6 w-6 rounded-full bg-primary grid place-items-center">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={() => setStep(1)}
                disabled={!selectedExam}
                className="bg-gradient-primary px-6"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Select Subjects */}
        {step === 1 && selectedExam && (
          <div>
            <h1 className="text-2xl font-bold font-heading mb-2">Select your subjects</h1>
            <p className="text-muted-foreground mb-6">
              Choose which subjects you want to focus on for {selectedExam.shortName}. You can change this later.
            </p>

            <div className="space-y-3">
              {selectedExam.subjects.map((subject) => {
                const isSelected = selectedSubjects.includes(subject.name);
                return (
                  <button
                    key={subject.name}
                    onClick={() => toggleSubject(subject.name)}
                    className={`w-full text-left p-5 rounded-2xl transition-all duration-200 ${
                      isSelected
                        ? "glass border border-primary/30"
                        : "glass-card opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <div className="flex-1">
                        <div className="font-semibold">{subject.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {subject.topics.length} topics · {subject.topics.slice(0, 3).join(", ")}{subject.topics.length > 3 ? "..." : ""}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={selectedSubjects.length === 0}
                className="bg-gradient-primary px-6"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Target Date */}
        {step === 2 && selectedExam && (
          <div>
            <h1 className="text-2xl font-bold font-heading mb-2">When's your exam?</h1>
            <p className="text-muted-foreground mb-6">
              Set a target date so we can build a personalized study plan. You can skip this.
            </p>

            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Exam date</div>
                  <div className="text-xs text-muted-foreground">Typically held in {selectedExam.typicalMonth}</div>
                </div>
              </div>

              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="text-base"
              />

              {daysRemaining !== null && daysRemaining > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="text-3xl font-bold font-heading text-gradient">{daysRemaining}</div>
                  <div className="text-sm text-muted-foreground">days until your exam</div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="glass-card p-5 rounded-2xl mt-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                Setup summary
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exam</span>
                  <span className="font-medium">{selectedExam.icon} {selectedExam.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subjects</span>
                  <span className="font-medium">{selectedSubjects.length} selected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Topics</span>
                  <span className="font-medium">
                    {selectedExam.subjects
                      .filter((s) => selectedSubjects.includes(s.name))
                      .reduce((sum, s) => sum + s.topics.length, 0)}
                  </span>
                </div>
                {targetDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target date</span>
                    <span className="font-medium">
                      {new Date(targetDate + "T00:00:00").toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleFinish}
                disabled={loading}
                className="bg-gradient-primary px-8"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Studying
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
