# ROBOCO CLI — Product Requirements Document

> **Version:** 1.1 (MVP)
> **Date:** 2026-04-04
> **Status:** Draft
> **기반 문서:** [ideation.md](./ideation.md), [심층인터뷰 스펙](./../.omc/specs/deep-interview-roboco-cli.md), [리서치 리포트](./research-report.md)

---

## 1. 개요

ROBOCO CLI는 리포지토리에 **바이브 코딩 환경을 셋팅해주는 AI 기반 스캐폴딩 도구**이다. 개발자가 `npx roboco init`을 실행하면 대상 리포지토리의 구조와 기술 스택을 자동 분석한 뒤, Claude Code SDK를 통해 터미널에서 AI 인터뷰를 수행하여 맞춤형 바이브 코딩 환경을 구성한다.

### 핵심 철학

바이브 코딩에 필수적인 프로세스, 문서화, 하네스는 모두 **소스와 함께 관리**되어 어떤 작업자가 오더라도 동일한 원칙이 준수되어야 한다. 바이브 코딩을 하지 않는 멤버가 있더라도 **CI/CD에서 관련 규칙이 강제**될 수 있어야 한다.

## 2. 목표 사용자

- Claude Code를 사용하여 바이브 코딩을 수행하는 개발자
- 팀 리포지토리에 일관된 바이브 코딩 환경을 구축하려는 테크 리드
- Claude 구독 또는 API 키를 보유한 사용자

## 3. 사용자 흐름

```
npx roboco init [path]
  → 1. 리포지토리 분석 (스택 감지, 구조 파악, 기존 설정 확인)
  → 2. Claude Code SDK를 통한 AI 인터뷰 (터미널 직접 Q&A)
  → 3. 인터뷰 결과 기반 설정 생성
  → 4. 필수 항목 자동 설치 (OMC 등)
  → 5. 선택 항목 설치 (OpenSpec, perplexity-ask MCP 등)
  → 6. 검증 및 리포트
```

## 4. 셋업 영역

### 4.1 Claude Code 환경 (필수)

| 산출물 | 설명 |
|--------|------|
| `CLAUDE.md` | 리포 특성에 맞는 AI 맞춤 컨텍스트 문서 (커뮤니티 표준 구조 적용) |
| `.claude/` | settings, commands, skills 디렉토리 구성 |
| Claude Code Hooks | `.claude/settings.json`에 스택별 hooks 템플릿 자동 생성 (lint/format/typecheck 자동화) |
| MCP 서버 설정 | 필요한 MCP 서버 자동 구성 |
| oh-my-claudecode (OMC) | 통째 설치 (dependency) |

### 4.2 프로세스 문서 (선택)

| 산출물 | 설명 |
|--------|------|
| 바이브 코딩 5단계 템플릿 | 의도전달 → 요건정의 → 조사 → 계획 → 구현 |
| OpenSpec | 프로세스 문서화 프레임워크 |

각 단계별로 문서를 남기고 언제든지 원하는 단계부터 다시 시작할 수 있어야 한다.

### 4.3 CI/CD 파이프라인 (선택)

| 산출물 | 설명 |
|--------|------|
| pre-commit hooks | 바이브 코딩 규칙 강제 |
| GitHub Actions 워크플로우 | CI에서 규칙 검증 자동화 |

### 4.4 스택 분석 및 최적화 (자동)

- 리포의 기술 스택 자동 감지
- 언어 비의존 공통 설정 기반으로 스택별 최적화된 설정 제공

## 5. 명령어

### `roboco init [options] [path]`

리포지토리를 분석하고 AI 인터뷰를 통해 바이브 코딩 환경을 셋업한다.

| 옵션 | 설명 |
|------|------|
| `--auto` | AI가 셋업을 제안하고 승인만 결정 (비대화형) |
| `--dryrun` | 분석 후 제안만 출력 (실제 변경 없음) |

### `roboco install [path]`

팀원이 clone 후 기존 설정을 즉시 활성화한다. `init`과 달리 AI 인터뷰 없이 리포에 저장된 기존 설정을 그대로 적용한다.

```bash
git clone [repo] && npx roboco install
```

### `roboco update [options] [path]`

`init`과 동일한 흐름으로 기존 설정을 업데이트한다.

### `roboco status [options] [path]`

대상 리포지토리의 바이브 코딩 셋업 상태를 리포트한다. (CLAUDE.md 존재 여부, .claude/ 구성, MCP 서버 설정, OMC 설치 상태 등)

| 옵션 | 설명 |
|------|------|
| `--format <type>` | 출력 포맷 지정: `text`, `markdown`, `pdf` |

### `roboco doctor`

ROBOCO CLI 도구 자체의 상태를 진단한다. (버전 업데이트 확인, ROBOCO 설정 유효성, 의존성 설치 상태, Claude Code SDK 연결 여부 등)

### `roboco config [options]`

글로벌 ROBOCO 설정을 조회하고 수정한다.

## 6. 도구 통합

| 도구 | 역할 | 통합 방식 | MVP |
|------|------|----------|-----|
| oh-my-claudecode (OMC) | 멀티에이전트 오케스트레이션 | 통째 설치 (dependency) | **필수** |
| Claude Code Hooks | lint/format/typecheck 자동화 | 스택별 템플릿 자동 생성 | **필수** |
| OpenSpec | 바이브 코딩 5단계 프로세스 문서화 | 선택적 설치 | 선택 |
| Exa.ai MCP | 코드/기술 문서 웹 검색 (조사 단계 기본 도구) | 선택적 설치 (API 키 필요) | 선택 |
| perplexity-ask MCP | 일반 웹 검색/Q&A (fallback) | 선택적 설치 (API 키 필요) | 선택 |
| GitHub MCP | 이슈/PR 관리, 코드 검색 | 선택적 설치 (GitHub 토큰 필요) | 선택 |
| Context7 MCP | 라이브러리/프레임워크 최신 문서 주입 | 선택적 설치 | 선택 |

## 7. 기술 스택

| 항목 | 선택 |
|------|------|
| 언어 | TypeScript |
| 런타임 | Node.js |
| CLI 프레임워크 | Commander.js |
| AI 연동 | Claude Code SDK |
| 배포 | npm publish (`npx roboco init` 즉시 실행) |
| CI/CD | GitHub Actions |

## 8. 제약 조건

- Claude 구독 또는 API 키 필수 (Claude Code SDK 의존)
- 지원 프로젝트: 언어 비의존 (MVP부터 모든 스택 공통 설정 기반)
- CLI only (GUI/웹 인터페이스 없음)
- Claude 이외의 AI 모델 미지원

## 9. 비목표 (Non-Goals)

- MVP에서 OpenClaw 기반 이슈 대응 및 배포 자동화
- 특정 언어/프레임워크 특화 설정 프리셋
- 자체 MCP 서버 구현 (기존 도구 통합만)
- GUI/웹 인터페이스

## 10. 인수 기준 (Acceptance Criteria)

### 핵심 기능
- [ ] `npx roboco init`으로 즉시 실행 가능
- [ ] init 실행 시 리포지토리 구조 및 기술 스택을 자동 감지
- [ ] Claude Code SDK를 통해 터미널에서 AI 인터뷰가 동작
- [ ] 인터뷰 결과에 기반하여 CLAUDE.md가 리포 특성에 맞게 생성됨

### 환경 유효성
- [ ] .claude/ 설정이 유효하고 Claude Code가 오류 없이 로드함
- [ ] Claude Code Hooks가 스택에 맞게 `.claude/settings.json`에 생성됨
- [ ] OMC가 정상 동작함
- [ ] 선택한 MCP 서버(Exa.ai, perplexity-ask, GitHub, Context7, OpenSpec)가 정상 설치됨

### 팀 일관성
- [ ] CI에서 pre-commit hook이 바이브 코딩 규칙을 강제함
- [ ] `roboco install`로 팀원이 clone 후 동일한 바이브 코딩 환경을 즉시 얻음

### 명령어
- [ ] `--auto` 옵션으로 비대화형 셋업이 가능함
- [ ] `--dryrun` 옵션으로 변경 없이 제안만 출력됨
- [ ] `roboco status`가 대상 리포의 바이브 코딩 셋업 상태를 정확히 리포트함
- [ ] `roboco doctor`가 ROBOCO CLI 자체의 버전, 의존성, SDK 연결을 진단함

## 11. 주요 설계 결정

| 결정 | 선택 | 근거 |
|------|------|------|
| OMC 통합 방식 | 통째 설치 | 유지보수 부담 감소, OMC 업데이트 자동 반영 |
| AI 인터뷰 방식 | CLI 직접 (SDK 호출) | 단일 UX, 별도 세션 불필요 |
| Claude Code SDK 필요성 | 필수 | 리포 분석 → AI 해석 → 맞춤형 설정 생성이 핵심 가치 |
| MVP 스택 지원 범위 | 언어 비의존 | 공통 설정 기반으로 모든 프로젝트 즉시 지원 |
| OpenClaw 자동화 | MVP 제외 | 핵심 기능에 집중, 로드맵에 포함 |
| 웹 검색 도구 | Exa.ai 기본 + Perplexity fallback | Exa가 코드/기술 문서 검색 특화 (정확도 64.8% vs 60.1%), OMC 공식 채택 |
| Claude Code Hooks | 필수 산출물 | `.claude/settings.json` hooks가 AI 세션 내 규칙 강제 담당. pre-commit hooks(CI)와 별도 |
| init vs install 분리 | 분리 | 유사 CLI 63%가 "초기화"와 "적용" 분리. 팀원 온보딩 UX 개선 |
| lint 명령어 | 제외 | 바이브 코딩 환경의 "올바름"은 정적으로 판단 불가. doctor(도구 자체 진단)와 status(리포 상태 리포트)로 충분 |

## 12. 로드맵

### MVP (v0.1)
- `init`, `install`, `update`, `status`, `doctor`, `config` 명령어 구현
- AI 인터뷰 기반 맞춤 셋업
- Claude Code Hooks 스택별 템플릿 자동 생성
- OMC 통째 설치
- 선택적 MCP 서버 설치: Exa.ai(기본 추천), perplexity-ask, GitHub, Context7, OpenSpec
- npm 배포 (`npx roboco init` 즉시 실행)
- OMC 패턴 참고: 플러그인 아키텍처, semantic-release

### v0.2
- `add`, `sync`, `validate` 명령어 추가
- 스택별 특화 설정 프리셋 (TypeScript, Python, Go, Java 등)
- Tier 2 MCP 서버: Playwright(프론트엔드), Snyk(보안), PostgreSQL/SQLite(백엔드)

### v0.3
- `audit` 명령어 (바이브 코딩 성숙도 점수화)
- OpenClaw 기반 이슈 자동 대응 및 릴리스 자동화

### Future
- `eject`, `share` 명령어
- 커뮤니티 프리셋/플러그인 생태계
- Claude Code Plugin으로 배포 검토
