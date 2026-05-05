export interface StackInfo {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  packageManager: string | null;
  hasTypeScript: boolean;
}

export interface RepoStructure {
  rootFiles: string[];
  rootDirs: string[];
  sourceDir: string | null;
  testDir: string | null;
  hasMonorepo: boolean;
}

export interface ExistingConfig {
  hasClaude: boolean;
  hasClaudeMd: boolean;
  hasOmc: boolean;
  hasRoboco: boolean;
  hasOpenSpec: boolean;
  claudeSettings: Record<string, unknown> | null;
  claudeSkills: string[];
  claudeCommands: string[];
  globalSettings: Record<string, unknown> | null;
  globalSkills: string[];
}

export interface GitInfo {
  isRepo: boolean;
  remoteUrl: string | null;
  repoName: string | null;
  branch: string | null;
}

export interface RepoSignals {
  hasProto: boolean;
}

export interface AnalysisResult {
  path: string;
  stack: StackInfo;
  structure: RepoStructure;
  existing: ExistingConfig;
  git: GitInfo;
  signals: RepoSignals;
}
