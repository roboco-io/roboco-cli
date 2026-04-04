# ROBOCO CLI — Implementation Reference

각 모듈의 상세 구현 절차.

---

## project-setup

프로젝트 초기 구조를 생성한다.

### 절차

1. `npm init -y`로 package.json 생성
2. package.json 수정:
   ```json
   {
     "name": "roboco",
     "version": "0.1.0",
     "description": "AI-native development scaffolding system",
     "type": "module",
     "bin": { "roboco": "./dist/index.js" },
     "scripts": {
       "build": "tsup",
       "dev": "tsup --watch",
       "test": "vitest",
       "test:run": "vitest run",
       "lint": "eslint src/",
       "typecheck": "tsc --noEmit"
     },
     "engines": { "node": ">=20.0.0" },
     "files": ["dist", "templates"]
   }
   ```
3. 의존성 설치:
   - **dependencies**: `commander`, `chalk`, `ora`, `@anthropic-ai/claude-code-sdk`
   - **devDependencies**: `typescript`, `tsup`, `vitest`, `eslint`, `prettier`, `@types/node`
4. tsconfig.json 생성 (strict, ESM, target ES2022)
5. tsup.config.ts 생성 (entry: src/index.ts, format: esm, dts: true)
6. src/index.ts 엔트리포인트 작성 (Commander 기본 설정)
7. `npm run build` 로 빌드 성공 확인

### 검증
- `npm run build` 성공
- `node dist/index.js --version` 출력
- `node dist/index.js --help` 출력

---

## types

타입 정의 모듈.

### 절차

1. `src/types/config.ts` — RobocoConfig, GlobalConfig 타입
2. `src/types/analysis.ts` — AnalysisResult, StackInfo, RepoStructure 타입
3. `src/types/interview.ts` — InterviewResult, SetupDomains, ToolSelection 타입
4. `src/types/index.ts` — 재export

### 검증
- `npm run typecheck` 성공

---

## utils

유틸리티 모듈.

### 절차

1. `src/utils/logger.ts`:
   - chalk 기반 색상 로거
   - info, success, warn, error, debug 레벨
   - `--no-color` 옵션 지원

2. `src/utils/fs.ts`:
   - `ensureDir(path)`: 디렉토리 없으면 생성
   - `fileExists(path)`: 파일 존재 확인
   - `readJson(path)`: JSON 파일 읽기
   - `writeJson(path, data)`: JSON 파일 쓰기 (pretty)
   - `copyTemplate(src, dest, vars)`: 템플릿 복사 + 변수 치환

3. `src/utils/git.ts`:
   - `isGitRepo(path)`: git 리포 여부
   - `getRemoteUrl(path)`: remote URL 추출
   - `getRepoName(path)`: 리포 이름 추출

4. `src/utils/prompt.ts`:
   - `confirm(message)`: Y/n 확인
   - `select(message, choices)`: 선택지
   - `input(message)`: 자유 입력

### 검증
- 각 유틸 함수 단위 테스트

---

## analyzer

리포지토리 분석기.

### 절차

1. `analyze(targetPath)` 메인 함수 구현
2. `detectStack(path)` 구현:
   - `package.json` → frameworks (react, vue, next, express 등) 감지
   - `tsconfig.json` → TypeScript 여부
   - `pyproject.toml` / `requirements.txt` → Python
   - `go.mod` → Go
   - `Cargo.toml` → Rust
   - `pom.xml` / `build.gradle` → Java
   - 복수 스택 감지 (모노레포)
3. `scanStructure(path)` 구현:
   - 최상위 디렉토리/파일 목록
   - src/, lib/, app/ 등 소스 디렉토리 감지
   - 테스트 디렉토리 감지
4. `checkExisting(path)` 구현:
   - CLAUDE.md 존재 여부
   - .claude/ 디렉토리 존재 및 내용
   - .omc/ 존재 여부
   - .roboco/ 존재 여부
   - openspec/ 존재 여부
5. `getGitInfo(path)` 구현

### 검증
- tests/fixtures/에 다양한 프로젝트 fixture 생성 (TS, Python, Go, 모노레포)
- 각 fixture에 대해 올바른 분석 결과 확인

---

## interviewer

AI 인터뷰 엔진.

### 절차

1. Claude Code SDK 초기화:
   ```typescript
   import { ClaudeCode } from '@anthropic-ai/claude-code-sdk';
   ```

2. 시스템 프롬프트 구성:
   - 분석 결과(AnalysisResult)를 컨텍스트로 포함
   - 인터뷰 질문 흐름 정의
   - 구조화된 응답 형식 지정

3. 대화형 모드 구현:
   - AI가 분석 결과 기반으로 질문 생성
   - 사용자 응답 수집
   - 응답을 InterviewResult로 구조화

4. auto 모드 구현:
   - AI가 분석 결과만으로 최적 설정 제안
   - 제안 내용을 사용자에게 표시
   - 승인/거부/수정 선택

5. InterviewResult 반환

### 검증
- SDK mock으로 단위 테스트
- 대화 흐름 시나리오 테스트

---

## generator

설정 파일 생성기.

### 절차

1. `generate(analysis, interview)` 메인 함수
2. 파일 생성 계획 수립:
   ```typescript
   interface FileOperation {
     path: string;
     content: string;
     action: 'create' | 'merge' | 'skip';
     backup?: boolean;
   }
   ```
3. 각 셋업 영역별 생성 로직 호출:
   - `claude-env.ts` → CLAUDE.md, .claude/settings.json, hooks
   - `process-docs.ts` → docs/vibe-coding/ 문서 템플릿
   - `cicd.ts` → .github/workflows/, .husky/
   - `stack-optimizer.ts` → 스택별 최적화 설정
4. 충돌 처리:
   - 기존 파일 발견 시 백업 생성 (.bak)
   - CLAUDE.md는 기존 내용과 머지 시도
   - .claude/settings.json은 deep merge
5. .roboco/config.json 생성 (install에서 재사용)

### 검증
- 빈 리포에서 generate 실행 → 기대 파일 생성 확인
- 기존 설정 있는 리포에서 generate → 충돌 처리 확인
- 스냅샷 테스트

---

## installer

도구 설치기.

### 절차

1. OMC 설치:
   ```bash
   # OMC 설치 명령어 (npm 또는 claude plugin)
   ```

2. MCP 서버 설치 (각각):
   ```bash
   # Exa.ai
   claude mcp add -e EXA_API_KEY=${key} exa -- npx -y exa-mcp-server

   # Perplexity
   claude mcp add -e PERPLEXITY_API_KEY=${key} perplexity-ask -- npx -y @anthropic-ai/perplexity-ask

   # GitHub
   claude mcp add -e GITHUB_TOKEN=${key} github -- docker run ghcr.io/github/github-mcp-server

   # Context7
   claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
   ```

3. OpenSpec 설치:
   ```bash
   # openspec 초기화
   ```

4. API 키 처리:
   - 환경변수에 이미 설정되어 있으면 그대로 사용
   - 없으면 사용자에게 입력 요청 (선택적)
   - 키를 .env에 저장할지 여부 확인

5. 설치 결과 반환 (성공/실패/스킵)

### 검증
- execa mock으로 명령어 실행 확인
- API 키 없을 때 graceful skip 확인

---

## init

init 명령어 통합.

### 절차

1. Commander 서브커맨드 등록:
   ```typescript
   program
     .command('init [path]')
     .description('Initialize ROBOCO in your project')
     .option('--auto', 'Auto-setup with AI suggestions')
     .option('--dryrun', 'Analyze and suggest without changes')
     .action(initCommand);
   ```

2. initCommand 구현: analyzer → interviewer → generator → installer 파이프라인

3. 에러 처리:
   - 이미 init된 리포: 경고 + update 안내
   - git 리포가 아님: 경고 (진행은 가능)
   - SDK 연결 실패: 에러 + doctor 안내

4. 결과 리포트:
   ```
   ✓ ROBOCO initialized successfully!

   Created:
     - CLAUDE.md
     - .claude/settings.json
     - .roboco/config.json

   Installed:
     - oh-my-claudecode
     - exa.ai MCP server

   Next steps:
     1. Review CLAUDE.md and customize if needed
     2. Start Claude Code: claude
     3. Try: "바이브 코딩 프로세스를 시작해줘"
   ```

### 검증
- E2E: 빈 fixture 리포에서 init → 모든 산출물 확인
- dryrun: 파일 변경 없음 확인
- 이미 init된 리포: 적절한 경고 확인

---

## install

install 명령어.

### 절차

1. Commander 서브커맨드 등록
2. `.roboco/config.json` 에서 설정 로드
3. 설정이 없으면: `Error: This repository has not been initialized with ROBOCO. Run 'roboco init' first.`
4. config의 `installedTools` 기반으로 installer 호출
5. .claude/ 설정 활성화 (환경 변수, hooks 등)

### 검증
- init된 리포에서 install → 도구 설치 확인
- init 안 된 리포에서 install → 에러 메시지 확인

---

## update

update 명령어.

### 절차

1. 기존 config 로드
2. 리포 재분석 (변경 사항 diff)
3. 변경이 감지되면 AI 인터뷰로 업데이트 범위 결정
4. generator를 머지 모드로 실행
5. 도구 업데이트 (버전 확인)

### 검증
- 스택 변경 감지 후 설정 업데이트 확인
- 기존 커스터마이징 보존 확인

---

## status

status 명령어.

### 절차

1. RobocoConfig 로드 (없으면 분석만 수행)
2. 각 항목 점검:
   ```
   ROBOCO Status Report
   ═══════════════════

   CLAUDE.md          ✓ exists (last updated: 2026-04-04)
   .claude/           ✓ configured (3 skills, 2 commands)
   OMC                ✓ installed (v1.2.3)
   MCP Servers        ✓ exa.ai, context7
   Hooks              ✓ 2 active (PostToolUse: prettier, eslint)
   CI/CD              ✗ not configured
   Process Docs       ✗ not configured

   Stack: TypeScript + React + Node.js
   Initialized: 2026-04-04
   Last updated: 2026-04-04
   ```
3. format 옵션에 따라 출력 형식 변환

### 검증
- 다양한 설정 상태에서 정확한 리포트 출력 확인

---

## doctor

doctor 명령어.

### 절차

1. 진단 항목 순차 실행:
   ```
   ROBOCO Doctor
   ═════════════

   ✓ ROBOCO CLI version    0.1.0 (latest)
   ✓ Node.js version       v22.1.0 (>=20 required)
   ✓ Claude Code SDK       connected
   ✓ API key               valid
   ✓ Global config         ~/.roboco/config.json exists
   ✗ OMC                   not found globally
     → Run: npm install -g oh-my-claudecode

   5/6 checks passed
   ```
2. 실패 항목에 대한 해결 방법 제시

### 검증
- 각 진단 항목 mock 테스트
- 실패 시 적절한 안내 메시지 확인

---

## config

config 명령어.

### 절차

1. 설정 파일 위치: `~/.roboco/config.json`
2. 서브커맨드:
   - `roboco config` → 전체 설정 출력
   - `roboco config get <key>` → 특정 값 조회
   - `roboco config set <key> <value>` → 값 설정
   - `roboco config reset` → 기본값 초기화
3. 기본 설정:
   ```json
   {
     "defaultTools": ["omc"],
     "updateCheck": true,
     "telemetry": false
   }
   ```

### 검증
- get/set/reset 동작 확인
- 잘못된 키 입력 시 에러 처리 확인
