export interface SetupDomains {
  claudeEnv: boolean;
  processDocs: boolean;
  cicd: boolean;
}

export interface ToolSelection {
  omc: true;
  openspec: boolean;
  exaAi: boolean;
  perplexityAsk: boolean;
  githubMcp: boolean;
  context7: boolean;
  harness: boolean;
  toolbox: boolean;
}

export interface InterviewResult {
  setupDomains: SetupDomains;
  tools: ToolSelection;
  preferences: Record<string, unknown>;
}
