import { getWorkspaceSnapshot } from "@/lib/mission-control";
import { MissionControlDashboard } from "@/components/mission-control-dashboard";

export default async function Home() {
  const snapshot = await getWorkspaceSnapshot();

  return <MissionControlDashboard snapshot={snapshot} />;
}
