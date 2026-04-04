---
name: roboco-implement
description: ROBOCO CLI 명령어 및 모듈 구현 가이드. 구현 작업 시 /roboco-implement [모듈명]으로 호출하여 해당 모듈의 구현 절차를 확인.
disable-model-invocation: true
argument-hint: [module-name] (init|install|update|status|doctor|config|analyzer|interviewer|generator|installer|project-setup)
---

# ROBOCO CLI — Implementation Guide

ROBOCO CLI의 각 모듈을 구현할 때 이 스킬을 호출한다. 아키텍처 상세는 자동으로 로드되는 `roboco-architecture` 스킬을 참조.

- 모듈별 상세 구현 가이드: [reference.md](reference.md)
- PRD: [docs/PRD.md](../../../docs/PRD.md)

## 구현 순서 (의존성 기반)

```
Phase 1: 프로젝트 기반
  project-setup → types → utils

Phase 2: 핵심 엔진
  analyzer → interviewer → generator → installer

Phase 3: 명령어
  init → install → update → status → doctor → config

Phase 4: 셋업 영역
  claude-env → process-docs → cicd → stack-optimizer

Phase 5: 템플릿
  claude-md → claude-settings → hooks → cicd → process
```

## 공통 규칙

1. **ESM only**: `import/export` 사용, `require` 금지
2. **strict TypeScript**: `strict: true`, `any` 사용 금지
3. **에러 처리**: 사용자 대면 에러는 친절한 메시지 + exit code, 내부 에러는 throw
4. **테스트**: 각 모듈 구현 후 `tests/` 에 대응하는 테스트 작성
5. **의존성 최소화**: 필수 의존성만 추가, 유사 기능 중복 금지

## 모듈별 구현 가이드

`$ARGUMENTS`에 해당하는 모듈의 상세 구현 절차는 [reference.md](reference.md)를 참조하라.

### 빠른 참조

| 모듈 | 파일 | 핵심 의존성 | 테스트 전략 |
|------|------|------------|-----------|
| project-setup | package.json, tsconfig.json, tsup.config.ts | - | 빌드 성공 확인 |
| types | src/types/*.ts | - | 타입 컴파일 확인 |
| utils | src/utils/*.ts | chalk, ora | 단위 테스트 |
| analyzer | src/core/analyzer.ts | glob, fs | fixture 리포로 통합 테스트 |
| interviewer | src/core/interviewer.ts | @anthropic-ai/claude-code-sdk | mock SDK로 단위 테스트 |
| generator | src/core/generator.ts | handlebars (또는 자체 템플릿) | 출력 파일 스냅샷 테스트 |
| installer | src/core/installer.ts | execa | mock 실행으로 단위 테스트 |
| init | src/commands/init.ts | core/* | E2E (fixture 리포) |
| install | src/commands/install.ts | installer, fs | E2E (fixture 리포) |
| update | src/commands/update.ts | core/* | E2E (기존 설정 변경) |
| status | src/commands/status.ts | fs, analyzer | 출력 스냅샷 테스트 |
| doctor | src/commands/doctor.ts | execa, https | mock 응답 단위 테스트 |
| config | src/commands/config.ts | fs | 파일 I/O 단위 테스트 |
