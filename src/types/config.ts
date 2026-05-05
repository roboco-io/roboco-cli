import type { AnalysisResult } from './analysis.js';
import type { InterviewResult } from './interview.js';

export type OverrideKey =
  | 'husky-pre-commit'
  | 'ci-workflow-vibe-coding-check'
  | 'claude-deny-list'
  | 'claude-md-roboco-block';

export interface RobocoConfig {
  version: string;
  createdAt: string;
  updatedAt: string;
  analysis: AnalysisResult;
  interview: InterviewResult;
  installedTools: string[];
  overrides?: {
    skipGeneratorOutputs?: OverrideKey[];
  };
}

export interface GlobalConfig {
  defaultTools: string[];
  updateCheck: boolean;
  telemetry: boolean;
  [key: string]: unknown;
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  defaultTools: ['omc'],
  updateCheck: true,
  telemetry: false,
};
