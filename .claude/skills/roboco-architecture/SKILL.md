---
name: roboco-architecture
description: ROBOCO CLI 아키텍처 레퍼런스. 프로젝트 구조, 모듈 설계, 데이터 흐름, 기술 스택 결정사항. 구현 작업 시 자동 참조.
user-invocable: false
paths: "src/**,package.json,tsconfig.json"
---

# ROBOCO CLI — Architecture Reference

ROBOCO CLI는 리포지토리에 바이브 코딩 환경을 셋팅해주는 AI 기반 스캐폴딩 도구이다.

- 상세 PRD: [docs/PRD.md](../../../docs/PRD.md)
- 리서치 결과: [docs/research-report.md](../../../docs/research-report.md)
- 모듈별 상세 설계: [reference.md](reference.md)

## 기술 스택

| 항목 | 선택 | 비고 |
|------|------|------|
| 언어 | TypeScript (strict mode) | ESM 기반 |
| 런타임 | Node.js >= 20 | LTS |
| CLI 프레임워크 | Commander.js | 서브커맨드 패턴 |
| AI 연동 | @anthropic-ai/claude-code-sdk | 터미널 AI 인터뷰 |
| 패키지 매니저 | npm | `npx roboco init` 지원 |
| 빌드 | tsup | ESM 번들링 |
| 테스트 | vitest | 단위 + 통합 |
| 린팅 | ESLint + Prettier | flat config |

## 프로젝트 구조

```
roboco-cli/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                 # CLI 엔트리포인트 (Commander 설정)
│   ├── commands/                # 명령어 모듈
│   │   ├── init.ts              # roboco init
│   │   ├── install.ts           # roboco install
│   │   ├── update.ts            # roboco update
│   │   ├── status.ts            # roboco status
│   │   ├── doctor.ts            # roboco doctor
│   │   └── config.ts            # roboco config
│   ├── core/                    # 핵심 비즈니스 로직
│   │   ├── analyzer.ts          # 리포지토리 분석기 (스택 감지, 구조 파악)
│   │   ├── interviewer.ts       # AI 인터뷰 엔진 (Claude Code SDK)
│   │   ├── generator.ts         # 설정 파일 생성기
│   │   └── installer.ts         # 도구 설치기 (OMC, MCP 서버 등)
│   ├── setup-domains/           # 4개 셋업 영역
│   │   ├── claude-env.ts        # Claude Code 환경 (필수)
│   │   ├── process-docs.ts      # 프로세스 문서 (선택)
│   │   ├── cicd.ts              # CI/CD 파이프라인 (선택)
│   │   └── stack-optimizer.ts   # 스택 분석/최적화 (자동)
│   ├── templates/               # 생성할 파일 템플릿
│   │   ├── claude-md/           # CLAUDE.md 템플릿 조각
│   │   ├── claude-settings/     # .claude/ 설정 템플릿
│   │   ├── hooks/               # Claude Code Hooks 템플릿
│   │   ├── cicd/                # GitHub Actions 워크플로우 템플릿
│   │   └── process/             # 바이브 코딩 5단계 문서 템플릿
│   ├── utils/                   # 유틸리티
│   │   ├── fs.ts                # 파일시스템 헬퍼
│   │   ├── git.ts               # git 관련 유틸
│   │   ├── logger.ts            # 로깅 (색상, 레벨)
│   │   └── prompt.ts            # 터미널 프롬프트 유틸
│   └── types/                   # 타입 정의
│       ├── config.ts            # ROBOCO 설정 타입
│       ├── analysis.ts          # 분석 결과 타입
│       └── interview.ts         # 인터뷰 Q&A 타입
├── templates/                   # 정적 템플릿 파일 (번들 포함)
│   ├── claude-md/
│   ├── github-actions/
│   └── hooks/
└── tests/
    ├── commands/
    ├── core/
    └── fixtures/                # 테스트용 리포 fixture
```

## 데이터 흐름

### `roboco init` 파이프라인

```
1. CLI 파싱 (Commander.js)
   ↓
2. 리포 분석 (analyzer.ts)
   - 파일 구조 스캔
   - package.json, pyproject.toml 등에서 스택 감지
   - 기존 .claude/, CLAUDE.md 존재 여부 확인
   - git 상태 확인
   ↓
3. AI 인터뷰 (interviewer.ts)
   - Claude Code SDK로 AI 세션 시작
   - 분석 결과를 컨텍스트로 제공
   - 사용자에게 셋업 옵션 질문
   - 인터뷰 결과를 구조화된 InterviewResult로 반환
   ↓
4. 설정 생성 (generator.ts)
   - InterviewResult 기반으로 파일 생성 계획 수립
   - 템플릿 렌더링 (CLAUDE.md, .claude/settings.json 등)
   - 충돌 검사 (기존 파일 존재 시 머지 전략)
   ↓
5. 도구 설치 (installer.ts)
   - OMC 설치 (필수)
   - 선택된 MCP 서버 설치 (Exa.ai, Context7 등)
   - OpenSpec 설치 (선택)
   ↓
6. 검증 및 리포트
   - 생성된 파일 목록 출력
   - Claude Code 로드 테스트 (가능하면)
   - 다음 단계 안내
```

### `roboco install` 파이프라인 (팀원용)

```
1. CLI 파싱
   ↓
2. 기존 설정 탐지
   - .roboco/ 또는 .claude/ 설정 파일 읽기
   - 설치해야 할 도구 목록 추출
   ↓
3. 도구 설치 (installer.ts)
   - 설정에 명시된 도구들 자동 설치
   - AI 인터뷰 없이 진행
   ↓
4. 검증 및 리포트
```

## 핵심 타입

```typescript
// 리포 분석 결과
interface AnalysisResult {
  path: string;
  stack: StackInfo;           // 감지된 기술 스택
  structure: RepoStructure;   // 디렉토리 구조
  existing: ExistingConfig;   // 기존 .claude, CLAUDE.md 등
  git: GitInfo;               // git 상태
}

// AI 인터뷰 결과
interface InterviewResult {
  setupDomains: {
    claudeEnv: boolean;       // 항상 true (필수)
    processDocs: boolean;     // 선택
    cicd: boolean;            // 선택
  };
  tools: {
    omc: true;                // 항상 true (필수)
    openspec: boolean;
    exaAi: boolean;
    perplexityAsk: boolean;
    githubMcp: boolean;
    context7: boolean;
  };
  preferences: Record<string, unknown>;  // AI 인터뷰에서 수집한 추가 선호도
}

// ROBOCO 설정 (리포에 저장됨)
interface RobocoConfig {
  version: string;
  createdAt: string;
  updatedAt: string;
  analysis: AnalysisResult;
  interview: InterviewResult;
  installedTools: string[];
}
```

## 설계 원칙

1. **모듈 독립성**: 각 셋업 영역(claude-env, process-docs, cicd, stack-optimizer)은 독립 모듈로 다른 영역 없이도 동작
2. **템플릿 기반**: 하드코딩 대신 템플릿 파일 사용. 커스터마이징 용이
3. **점진적 셋업**: init은 전체 셋업, install은 재현, update는 부분 변경
4. **실패 안전**: 각 단계 실패 시 이전 단계까지의 결과는 보존
5. **AI 우선**: CLAUDE.md 등 컨텍스트 문서는 AI가 생성. 템플릿은 골격만 제공
