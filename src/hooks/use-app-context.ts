/**
 * React hook that assembles AppContext from cached React Query data.
 * Pages call this hook and pass the result to AI functions so
 * every AI interaction is aware of the student's current state.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayIST } from "@/lib/date-utils";
import { buildContextSummary, type AppContext } from "@/lib/ai-context";

export function useAppContext(): { appContext: AppContext; contextSummary: string } {
  const { data: profile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: api.getUserProfile,
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: api.getSubjects,
  });
  const { data: plan } = useQuery({
    queryKey: ["plan"],
    queryFn: api.getPlan,
  });
  const { data: userStats } = useQuery({
    queryKey: ["userStats"],
    queryFn: api.getUserStats,
  });

  const today = todayIST();
  const todayTasks = (plan ?? []).filter((p) => p.date === today);

  const appContext: AppContext = {
    examName: profile?.exam_name,
    targetDate: profile?.target_date,
    displayName: profile?.display_name,
    subjects: subjects ?? [],
    todayTasks,
    xp: userStats?.xp,
    level: userStats?.level,
    streak: userStats?.current_streak,
  };

  return { appContext, contextSummary: buildContextSummary(appContext) };
}
