import {
  getAccessorValue,
  parseLeaderboardLink,
  type LeaderboardRow,
} from "@/lib/leaderboard";

export type ChartRowLabel = {
  model: string;
  agent: string;
  /** Reasoning effort (e.g. "max"), when the row reports one. */
  reasoning: string;
  /** Full "Model (Agent)" string for tooltips / plain text. */
  full: string;
};

/** "Model (Agent)" label used across chart views. */
export function chartRowLabel(row: LeaderboardRow): ChartRowLabel {
  const agent =
    parseLeaderboardLink(getAccessorValue(row, "metadata.agent_display"))
      ?.label ?? String(getAccessorValue(row, "metadata.agent_display") ?? "");
  const model =
    parseLeaderboardLink(getAccessorValue(row, "metadata.model_display"))
      ?.label ?? String(getAccessorValue(row, "metadata.model_display") ?? "");

  const resolvedModel = model || (!agent ? row.id : "");
  const resolvedAgent = agent;
  const full =
    resolvedModel && resolvedAgent
      ? `${resolvedModel} (${resolvedAgent})`
      : resolvedModel || resolvedAgent || row.id;

  const reasoning = getAccessorValue(row, "metadata.reasoning_effort");

  return {
    model: resolvedModel || full,
    agent: resolvedAgent,
    reasoning: reasoning == null ? "" : String(reasoning),
    full,
  };
}
