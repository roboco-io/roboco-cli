# ROBOCO CLI - Ideation

- 바이브 코딩을 수행함에 있어 필수적인 프로세스, 문서화, 하네스 관련 영역들은 모두 소스와 함께 관리되어 어떤 작업자가 오더라도 동일한 원칙이 준수 되어야 한다. 심지어 바이브 코딩을 하지 않는 멤버가 있더라도 CI/CD에서는 관련 규칙이 강제될 수 있어야 한다. 이에 대한 자세한 설명은 https://roboco.io/posts/vibe-coding-rules-vs-taste/ 를 참조
- ROBOCO CLI는 리포지토리에 대해 바이브 코딩 환경을 셋팅해주는 스캐폴딩 도구이다.
- 개발자는 ROBOCO CLI를 사용해 바이브 코딩을 수행하는데 있어 최적의 프로세스, 문서화, 하네스를 간단하게 설정해서 사용할 수 있다.
- claude code sdk를 사용해서 동작하므로 클로드 구독 또는 API 키가 필수이다.
- 포함해야 하는 도구: 아래 도구들을 포함시킬지 또는 체리피킹해서 직접 구현할지에 대한 의사결정이 필요함
  - oh-my-claudecode(OMC)
  - openspec: 프로세스와 문서화에 대한 지침을 제시
  - puplixity-ask mcp: OMC에 포함된 exa.ai 대신 조사나 웹검색에 사용. exa.ai 와 비교한 리서치가 필요함.
  - 그 밖에 필수 도구가 있는지 리서치 필요
- 바이브 코딩 프로세스
  의도 전달 - 심층인터뷰를 통한 요건정의 - 조사 - 계획 - 구현 이렇게 다섯단계를 사용. 각단계별로 문서를 남기고 언제든지 원하는 단계부터 다시 시작할 수 있어야 함.
  
- 지원하는 프로젝트는 수요를 조사한 다음 많은것부터 순차적으로 MVP로 구현
- ROBOCO CLI 개발과 관련된 모든 사항들은 OpenClaw를 기반으로 해서 완전 자동화 한다. oh-my-claudecode와 OpenClaw의 개발 방식을 리서치 한 다음 참고할것

- 명령어

Usage: roboco [options] [command]

AI-native development scafloding system

Options:
  -V, --version                      output the version number
  --no-color                         Disable color output
  -h, --help                         display help for command

Commands:
  init [options] [path]              Initialize ROBOCO in your project. 리포지토리의 구성상태를 파악하고 AskUserQuestionTool을 사용한 심층 인터뷰를 통해 바이브 코딩 셋업을 진행하여 해당 리포지토리를 바이브 코딩에 최적화된 리포지토리로 변신시킬 수 있다. options 에 auto를 지정하면 알아서 셋업을 제안하고 이를 승인할지만 결정할 수 있음. dryrun은 분석후 제안만 받음.
  update [options] [path]            init과 동일함.
  status [options] [path]            설정된 내용을 리포트. options는 출력 포멧(text, markdown, pdf) 지정
  doctor                             ROBOCO 버전 업데이트와 각종 진단 수행
  config [options]                   View and modify global ROBOCO configuration
  help [command]                     display help for command

  - 이밖에 필요한 명령어를이 있는지 제안해줘