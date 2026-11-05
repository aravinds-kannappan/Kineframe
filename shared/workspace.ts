export type Focus = "gateway" | "checkout" | "payments" | "database";
export type Scenario = "pool" | "timeout";
export type PatchKind = "release" | "budget" | "health";
export type WorkspaceEvent = {
  id: number;
  time: string;
  kind: "user" | "agent" | "tool" | "result" | "change" | "error";
  title: string;
  detail: string;
};
export type Trace = {
  path: string;
  status: number;
  ms: number;
  error?: string;
  active: number;
};
export type TestResult = { name: string; pass: boolean; detail: string };
export type Evidence = {
  version: number;
  time: string;
  traces: Trace[];
  tests: TestResult[];
  active: number;
  passed: number;
  total: number;
};
export type Proposal = {
  id: string;
  kind: PatchKind;
  baseVersion: number;
  title: string;
  reason: string;
  before: string;
  after: string;
  file: string;
};
export type Workspace = {
  id: string;
  scenario: Scenario;
  version: number;
  focus: Focus;
  busy: boolean;
  mode: "guided" | "hosted";
  events: WorkspaceEvent[];
  evidence: Evidence | null;
  baseline: Evidence | null;
  proposal: Proposal | null;
  source: string;
  config: string;
  health: boolean;
  fixed: boolean;
  memory: string[];
  canUndo: boolean;
};
export const services: {
  id: Focus;
  name: string;
  subtitle: string;
  x: number;
  y: number;
}[] = [
  {
    id: "gateway",
    name: "Gateway",
    subtitle: "HTTP entry point",
    x: -3.1,
    y: 0,
  },
  {
    id: "checkout",
    name: "Checkout",
    subtitle: "Order orchestration",
    x: 0,
    y: 0,
  },
  {
    id: "payments",
    name: "Payments",
    subtitle: "Charge provider",
    x: 3.1,
    y: 1.3,
  },
  {
    id: "database",
    name: "Connection pool",
    subtitle: "3 available slots",
    x: 3.1,
    y: -1.3,
  },
];
