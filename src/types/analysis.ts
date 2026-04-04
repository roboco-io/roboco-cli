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
}

export interface GitInfo {
  isRepo: boolean;
  remoteUrl: string | null;
  repoName: string | null;
  branch: string | null;
}

export interface AnalysisResult {
  path: string;
  stack: StackInfo;
  structure: RepoStructure;
  existing: ExistingConfig;
  git: GitInfo;
}
