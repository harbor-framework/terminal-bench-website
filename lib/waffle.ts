export type WaffleTrialOutcome = 'p' | 'to' | 'err' | 'f';

export type WaffleTrial = {
  o: WaffleTrialOutcome;
  m: string;
  id: string;
  j: string | null;
  e: string | null;
};

export type WaffleTask = {
  task: string;
  p: number;
  f: number;
  e_to: number;
  e_err: number;
  solve: number;
  ts: WaffleTrial[];
};

export type WaffleDomain = {
  name: string;
  solve: number;
  n: number;
  tasks: WaffleTask[];
};

export type WafflePayload = {
  doms: WaffleDomain[];
  jobs: string[];
  leaderboard: {
    title: string;
    name: string;
  };
  row_count: number;
  trial_count: number;
  task_count: number;
  source: {
    leaderboard_url: string;
    leaderboard_ref: string;
    include_trajectories: false;
    fetched_at: string;
  };
  score_policy: string;
};
