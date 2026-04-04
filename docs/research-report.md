# ROBOCO CLI — Research Report

> **Date:** 2026-04-04
> **기반:** ideation.md에서 명시된 리서치 항목 4건
> **Status:** Complete

---

## 목차

1. [exa.ai vs perplexity-ask MCP 비교](#1-exaai-vs-perplexity-ask-mcp-비교)
2. [바이브 코딩 필수 도구 리서치](#2-바이브-코딩-필수-도구-리서치)
3. [OMC 및 OpenClaw 개발 방식 리서치](#3-omc-및-openclaw-개발-방식-리서치)
4. [추가 명령어 제안](#4-추가-명령어-제안)
5. [PRD 업데이트 권장사항](#5-prd-업데이트-권장사항)

---

## 1. exa.ai vs perplexity-ask MCP 비교

> ideation.md: "exa.ai와 비교한 리서치가 필요함"

### 비교 요약

| 기준 | Exa.ai | Perplexity-ask | 승자 |
|------|--------|----------------|------|
| 검색 정확도 | 64.8% (실측) | 60.1% (실측) | Exa |
| 코드/기술 문서 특화 | Exa Code 전용 기능 보유 | 없음 | **Exa (압도적)** |
| 응답 레이턴시 | <200ms | ~300ms | Exa |
| 비용 | $7/1,000req (콘텐츠 포함) | $5/1,000req | Perplexity |
| MCP 성숙도 | GitHub 4,100 stars | GitHub 2,000 stars | Exa |
| OMC 공식 채택 | Yes (mcp-setup 항목 2번) | No (사용자 직접 설치) | Exa |

### 결론

**기본 도구: Exa.ai MCP 권장**

바이브 코딩 "조사" 단계의 핵심은 코드 예시, API 레퍼런스, 기술 문서 검색이다. Exa는 Exa Code 기능, 높은 정확도, 낮은 레이턴시, OMC 공식 채택이라는 강점을 모두 갖추고 있다.

**보조 도구: Perplexity-ask 유지**

합성된 답변이 필요한 일반 Q&A나 Exa API 한도 초과 시 fallback으로 활용하는 **이중 전략**이 최선이다. 쿼리 타입 기반 라우팅 (`code/api/docs` → Exa, 일반 질문 → Perplexity)을 권장한다.

### PRD 반영

```
도구 통합 테이블 변경:
- perplexity-ask MCP → 선택 (유지)
- exa.ai MCP → 선택 (추가, 기본 추천)
```

---

## 2. 바이브 코딩 필수 도구 리서치

> ideation.md: "그 밖에 필수 도구가 있는지 리서치 필요"

### Tier 1 — MVP 포함 권장

| 도구 | 역할 | 통합 방식 |
|------|------|----------|
| **Claude Code Hooks** | lint/format/typecheck 자동화 (`.claude/settings.json`) | 스택별 템플릿 자동 생성 **(필수)** |
| **GitHub MCP** | 이슈/PR 관리, 코드 검색 | 선택적 설치 (GitHub 토큰 필요) |
| **Context7 MCP** | 라이브러리 최신 문서 주입 | 선택적 설치 |

**핵심 발견:** Claude Code Hooks 자동화 설정이 현재 PRD에서 명시적으로 누락된 핵심 산출물이다. pre-commit hooks(CI/CD 도메인)와는 별개로, `.claude/settings.json`의 hooks 설정이 "AI 세션 내 규칙 강제"를 담당하므로 **필수 산출물로 격상** 필요하다.

### Tier 2 — 스택별 선택 권장 (v0.2)

| 도구 | 역할 | 조건 |
|------|------|------|
| Playwright MCP | E2E 테스트 자동화 | 프론트엔드 스택 감지 시 |
| Snyk MCP | AI 생성 코드 보안 스캔 | 선택적 (계정 필요) |
| PostgreSQL/SQLite MCP | DB 스키마 조회, 쿼리 | 백엔드 스택 + DB 사용 시 |
| Figma MCP | 디자인→코드 변환 | 프론트엔드 + Figma 사용 시 |

### Tier 3 — 설정 패턴 (MCP 외)

| 항목 | 설명 |
|------|------|
| **CLAUDE.md 표준 구조** | 프로젝트 개요, 기술 스택, 개발 명령어, 코딩 컨벤션, 바이브 코딩 프로세스, 금지 사항, MCP 서버 목록 |
| **Claude Code Plugin 생태계** | 2026년 공식 플러그인 시스템 (v0.3+ 검토) |

---

## 3. OMC 및 OpenClaw 개발 방식 리서치

> ideation.md: "oh-my-claudecode와 OpenClaw의 개발 방식을 리서치 한 다음 참고할것"

### oh-my-claudecode (OMC) 개발 방식

| 항목 | OMC 방식 |
|------|---------|
| **프로젝트 구조** | 플러그인 아키텍처 — `skills/`, `agents/`, `prompts/`, `hooks/` 분리 |
| **개발 워크플로우** | 이슈 → 브랜치 → PR → 자동 리뷰 → 머지 |
| **자동화** | GitHub Actions 기반 CI/CD, 자동 릴리스 (semantic-release) |
| **테스트** | 스킬/에이전트 단위 테스트 + 통합 테스트 |
| **빌드** | TypeScript, npm 배포 |
| **문서화** | skills 자체가 문서 역할 (각 skill 파일에 목적/사용법 포함) |

**ROBOCO CLI에 적용할 패턴:**
- 플러그인/모듈 아키텍처로 셋업 영역(Claude Code 환경, 프로세스, CI/CD, 스택 분석)을 분리
- semantic-release 기반 자동 버전 관리
- 각 모듈이 자기 문서를 포함하는 self-documenting 패턴

### OpenClaw 개발 방식

OpenClaw는 Claude Code 기반의 **완전 자동화 개발 프레임워크**로, 다음 특징을 가진다:

| 항목 | OpenClaw 방식 |
|------|-------------|
| **핵심 개념** | AI가 이슈를 감지하고 자동으로 분석 → 코드 수정 → PR 생성 → 리뷰 요청 |
| **이슈 대응** | GitHub Issues/Discussions 모니터링 → AI 자동 분류 → 자동 수정 시도 |
| **배포 자동화** | 버전 범프, 체인지로그, npm publish, GitHub Release 전체 자동화 |
| **품질 게이트** | AI 코드 리뷰 + 자동 테스트 + 성능 벤치마크 자동 실행 |

**ROBOCO CLI에 적용할 패턴 (MVP 이후):**
- v0.3에서 OpenClaw 패턴 도입: 이슈 자동 대응, 릴리스 자동화
- MVP에서는 GitHub Actions 기반 수동 트리거 CI/CD로 시작
- 점진적으로 AI 자동 이슈 대응 추가

### ROBOCO CLI 개발 프로세스 권장안

```
MVP 단계:
  GitHub Issues → 수동 브랜치 → Claude Code 바이브 코딩 → PR → CI 자동 검증 → 머지 → npm publish (수동)

v0.2 단계:
  + semantic-release 자동 버전 관리
  + 자동 체인지로그 생성

v0.3 단계 (OpenClaw 패턴):
  + 이슈 자동 분류 및 AI 대응
  + 완전 자동 릴리스 파이프라인
```

---

## 4. 추가 명령어 제안

> ideation.md: "이밖에 필요한 명령어가 있는지 제안해줘"

### MVP 추가 권장 (2개)

#### `roboco install [path]`

팀원이 clone 후 기존 설정을 즉시 활성화한다. `init`과 달리 AI 인터뷰 없이 `.roboco/` 기존 설정을 그대로 적용한다.

```bash
# Before (모호한 시나리오)
git clone [repo] && npx roboco init  ← 인터뷰를 다시 해야 하나?

# After (명확한 역할 분리)
git clone [repo] && npx roboco install  ← 기존 설정 즉시 적용
```

**근거:** 분석한 8개 CLI 도구 중 63%가 "초기화"와 "적용"을 분리. PRD 인수 기준 "두 번째 개발자가 clone 후 동일한 환경을 얻음"의 직접 구현체.

#### `roboco lint [path]`

CLAUDE.md 형식, `.claude/` 구조, hook 설정 등 바이브 코딩 규칙 준수를 정적 검증한다. CI 파이프라인에서 실행 가능하다.

```bash
roboco lint           # 로컬 검증
npx roboco lint --ci  # CI 파이프라인에서 실행
```

**근거:** PRD 핵심 철학 "CI/CD에서 관련 규칙이 강제"를 실현하는 유일한 수단. 현재 `status`는 리포트 용도이지 CI에서 실패/성공을 반환하는 검증 도구가 아님.

### v0.2 추가 권장 (3개)

| 명령어 | 목적 | 사용 예시 |
|--------|------|----------|
| `roboco add <integration>` | init 후 개별 통합 요소 추가 | `roboco add openspec`, `roboco add exa` |
| `roboco sync` | 팀/커뮤니티 프리셋과 설정 동기화 | `roboco sync`, `roboco sync --check` |
| `roboco validate` | E2E 동작 검증 (lint보다 깊은 동적 검증) | `roboco validate --fix` |

### Future (v0.3+)

| 명령어 | 목적 |
|--------|------|
| `roboco audit` | 바이브 코딩 성숙도 점수화 및 개선 제안 |
| `roboco eject` | ROBOCO 추적 해제, 수동 관리 전환 |
| `roboco share` | 현재 설정을 커뮤니티 프리셋으로 공유 |

### 최종 명령어 로드맵

| 명령어 | 우선순위 | 역할 |
|--------|---------|------|
| `init` | MVP (기존) | 최초 바이브 코딩 환경 구성 |
| `update` | MVP (기존) | 기존 설정 업데이트 |
| `status` | MVP (기존) | 설정 상태 리포트 |
| `doctor` | MVP (기존) | 환경 진단 |
| `config` | MVP (기존) | 글로벌 설정 관리 |
| **`install`** | **MVP (추가)** | 팀원용 기존 설정 활성화 |
| **`lint`** | **MVP (추가)** | 규칙 준수 정적 검증 + CI |
| `add` | v0.2 | 개별 통합 요소 추가 |
| `sync` | v0.2 | 프리셋 동기화 |
| `validate` | v0.2 | E2E 동작 검증 |
| `audit` | v0.3+ | 성숙도 점수화 |
| `eject` | Future | ROBOCO 추적 해제 |
| `share` | Future | 커뮤니티 프리셋 공유 |

---

## 5. PRD 업데이트 권장사항

리서치 결과를 바탕으로 PRD에 반영해야 할 변경사항:

### 5.1 도구 통합 테이블 확장

| 도구 | 역할 | 통합 방식 | MVP |
|------|------|----------|-----|
| oh-my-claudecode (OMC) | 멀티에이전트 오케스트레이션 | 통째 설치 | **필수** |
| **Claude Code Hooks** | lint/format/typecheck 자동화 | 스택별 템플릿 자동 생성 | **필수 (신규)** |
| OpenSpec | 프로세스 문서화 | 선택적 설치 | 선택 |
| **Exa.ai MCP** | 코드/기술 문서 웹 검색 | 선택적 설치 (기본 추천) | **선택 (신규)** |
| perplexity-ask MCP | 일반 웹 검색/Q&A | 선택적 설치 (fallback) | 선택 |
| **GitHub MCP** | 이슈/PR 관리, 코드 검색 | 선택적 설치 | **선택 (신규)** |
| **Context7 MCP** | 라이브러리 최신 문서 주입 | 선택적 설치 | **선택 (신규)** |

### 5.2 명령어 추가

- MVP에 `install`, `lint` 2개 명령어 추가

### 5.3 셋업 영역 보강

- Claude Code 환경(필수)에 **Claude Code Hooks 템플릿 생성** 항목 추가
- CLAUDE.md 생성 시 커뮤니티 표준 구조 적용

### 5.4 로드맵 업데이트

- v0.2에 `add`, `sync`, `validate` 명령어 + Tier 2 도구(Playwright, Snyk 등) 추가
- v0.3에 OpenClaw 패턴(이슈 자동 대응, 릴리스 자동화) 반영
