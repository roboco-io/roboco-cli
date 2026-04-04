# ROBOCO CLI — Module Reference

## 1. commands/ — CLI 명령어 모듈

각 명령어는 Commander.js의 `.command()` 패턴을 따른다.

### init.ts

```typescript
// 핵심 흐름
export async function initCommand(path: string, options: InitOptions): Promise<void> {
  // 1. 경로 해석 및 유효성 검사
  // 2. analyzer.analyze(targetPath) 호출
  // 3. --dryrun이면 분석 결과만 출력 후 종료
  // 4. --auto면 AI가 자동 제안, 아니면 AI 인터뷰 진행
  // 5. generator.generate(analysis, interview) 호출
  // 6. installer.install(interview.tools) 호출
  // 7. 결과 리포트 출력
}

interface InitOptions {
  auto?: boolean;    // AI 자동 제안 모드
  dryrun?: boolean;  // 분석만 하고 변경 없음
}
```

### install.ts

```typescript
// AI 인터뷰 없이 기존 설정 적용
export async function installCommand(path: string): Promise<void> {
  // 1. 경로에서 .roboco/config.json 또는 기존 설정 탐지
  // 2. 설정이 없으면 에러 + init 안내
  // 3. config에 명시된 도구들 설치
  // 4. 환경 활성화 (hooks, MCP 서버 등)
  // 5. 결과 리포트
}
```

### update.ts

```typescript
// init과 동일한 흐름이나 기존 설정을 기반으로 업데이트
export async function updateCommand(path: string, options: UpdateOptions): Promise<void> {
  // 1. 기존 RobocoConfig 로드
  // 2. 리포 재분석 (변경사항 감지)
  // 3. AI 인터뷰 (변경이 필요한 부분만)
  // 4. 설정 머지 (기존 + 새로운)
  // 5. 변경된 파일만 재생성
  // 6. 도구 업데이트
}
```

### status.ts

```typescript
// 대상 리포의 바이브 코딩 셋업 상태 리포트
export async function statusCommand(path: string, options: StatusOptions): Promise<void> {
  // 1. RobocoConfig 로드
  // 2. 각 셋업 영역 상태 점검
  //    - CLAUDE.md 존재/내용 요약
  //    - .claude/ 구성 상태
  //    - OMC 설치 상태
  //    - MCP 서버 설정 상태
  //    - CI/CD hooks 상태
  // 3. 포맷에 맞게 출력 (text/markdown/pdf)
}

interface StatusOptions {
  format?: 'text' | 'markdown' | 'pdf';
}
```

### doctor.ts

```typescript
// ROBOCO CLI 자체의 상태 진단
export async function doctorCommand(): Promise<void> {
  // 1. ROBOCO CLI 버전 확인 (npm registry와 비교)
  // 2. Node.js 버전 호환성 확인
  // 3. Claude Code SDK 연결 테스트 (API 키 유효성)
  // 4. 글로벌 설정 유효성 검사
  // 5. 의존성 상태 확인 (OMC, MCP 서버 등)
  // 6. 진단 결과 출력 (✓/✗ 체크리스트)
}
```

### config.ts

```typescript
// 글로벌 ROBOCO 설정 관리
export async function configCommand(options: ConfigOptions): Promise<void> {
  // 설정 파일 위치: ~/.roboco/config.json
  // 1. options 없으면 현재 설정 출력
  // 2. get <key>: 특정 키 값 조회
  // 3. set <key> <value>: 설정 변경
  // 4. reset: 기본값으로 초기화
}

// 글로벌 설정 스키마
interface GlobalConfig {
  defaultTools: string[];        // init 시 기본 선택되는 도구
  apiKeyLocation: string;        // Claude API 키 위치 (env var name)
  telemetry: boolean;            // 사용 통계 전송 여부
  updateCheck: boolean;          // 자동 업데이트 확인
}
```

## 2. core/ — 핵심 비즈니스 로직

### analyzer.ts — 리포지토리 분석기

```typescript
export async function analyze(targetPath: string): Promise<AnalysisResult> {
  return {
    path: targetPath,
    stack: await detectStack(targetPath),
    structure: await scanStructure(targetPath),
    existing: await checkExisting(targetPath),
    git: await getGitInfo(targetPath),
  };
}

// 스택 감지 전략
async function detectStack(path: string): Promise<StackInfo> {
  // 1. package.json → Node.js/TypeScript/JavaScript
  // 2. pyproject.toml / requirements.txt → Python
  // 3. go.mod → Go
  // 4. Cargo.toml → Rust
  // 5. pom.xml / build.gradle → Java
  // 6. *.csproj → C#/.NET
  // 7. 복수 스택 가능 (모노레포)
}
```

### interviewer.ts — AI 인터뷰 엔진

```typescript
import { ClaudeCode } from '@anthropic-ai/claude-code-sdk';

export async function interview(
  analysis: AnalysisResult,
  options: { auto: boolean }
): Promise<InterviewResult> {
  // 1. Claude Code SDK 세션 시작
  // 2. 분석 결과를 시스템 프롬프트에 포함
  // 3. auto 모드: AI가 분석 기반으로 최적 설정 제안 → 사용자 승인/거부
  // 4. 대화형 모드: AI가 질문 → 사용자 응답 → 구조화된 결과 추출
  // 5. InterviewResult 반환
}
```

### generator.ts — 설정 파일 생성기

```typescript
export async function generate(
  analysis: AnalysisResult,
  interview: InterviewResult
): Promise<GenerateResult> {
  const files: FileOperation[] = [];

  // 1. CLAUDE.md 생성 (AI가 분석+인터뷰 결과 기반으로 작성)
  // 2. .claude/settings.json 생성 (hooks 포함)
  // 3. .claude/commands/ 생성 (선택)
  // 4. .roboco/config.json 생성 (install에서 사용)
  // 5. 선택된 셋업 영역별 파일 생성

  // 충돌 처리
  for (const file of files) {
    if (await exists(file.path)) {
      // 머지 전략: 백업 후 덮어쓰기 or 스킵
    }
  }
}
```

### installer.ts — 도구 설치기

```typescript
export async function install(tools: InterviewResult['tools']): Promise<InstallResult> {
  const results: InstallResult[] = [];

  // 필수: OMC 설치
  results.push(await installOMC());

  // 선택: MCP 서버 설치
  if (tools.exaAi) results.push(await installMCP('exa', { apiKeyEnv: 'EXA_API_KEY' }));
  if (tools.perplexityAsk) results.push(await installMCP('perplexity-ask', { apiKeyEnv: 'PERPLEXITY_API_KEY' }));
  if (tools.githubMcp) results.push(await installMCP('github', { apiKeyEnv: 'GITHUB_TOKEN' }));
  if (tools.context7) results.push(await installMCP('context7', {}));

  // 선택: OpenSpec 설치
  if (tools.openspec) results.push(await installOpenSpec());

  return results;
}

async function installMCP(name: string, config: MCPConfig): Promise<InstallResult> {
  // claude mcp add <name> -- <command> 실행
}
```

## 3. setup-domains/ — 셋업 영역 모듈

### claude-env.ts (필수)

생성 산출물:
- `CLAUDE.md` — AI가 분석+인터뷰 기반으로 생성 (커뮤니티 표준 구조)
- `.claude/settings.json` — hooks, MCP 서버, 권한 설정
- `.claude/commands/` — 프로젝트 커스텀 커맨드 (선택)
- `.claude/skills/` — 프로젝트 스킬 (선택)

CLAUDE.md 표준 구조:
```markdown
# {프로젝트명}

## 프로젝트 개요
## 기술 스택
## 개발 명령어 (build, test, lint)
## 코딩 컨벤션
## 바이브 코딩 프로세스
## 금지 사항
```

Claude Code Hooks 템플릿 (스택별):
```json
// TypeScript 프로젝트
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write $CLAUDE_FILE_PATH"
      }]
    }]
  }
}
```

### process-docs.ts (선택)

생성 산출물:
- `docs/vibe-coding/` — 바이브 코딩 5단계 문서 디렉토리
  - `01-intent.md` — 의도전달 템플릿
  - `02-requirements.md` — 요건정의 템플릿
  - `03-research.md` — 조사 템플릿
  - `04-plan.md` — 계획 템플릿
  - `05-implement.md` — 구현 체크리스트
- OpenSpec 초기화 (`openspec/config.yaml`)

### cicd.ts (선택)

생성 산출물:
- `.husky/pre-commit` — pre-commit hook
- `.github/workflows/vibe-coding-check.yml` — CI 워크플로우

### stack-optimizer.ts (자동)

스택별 최적화 설정:
- TypeScript: ESLint, Prettier hooks, tsconfig 참조
- Python: Black, Ruff hooks, pyproject.toml 참조
- Go: gofmt hooks, go.mod 참조
- 기타: 공통 설정만 적용

## 4. templates/ — 정적 템플릿

템플릿은 Mustache 스타일 변수 치환을 사용:
- `{{projectName}}` — 프로젝트 이름
- `{{stack}}` — 감지된 기술 스택
- `{{buildCommand}}` — 빌드 명령어
- `{{testCommand}}` — 테스트 명령어
- `{{lintCommand}}` — 린트 명령어

템플릿과 AI 생성의 역할 분담:
- 템플릿: 구조적 골격 제공 (디렉토리, 파일 형식, 필수 섹션)
- AI: 컨텍스트 기반 내용 채우기 (CLAUDE.md 본문, hooks 세부 설정)
