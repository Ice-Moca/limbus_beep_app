# Limbus Beep App (단테 삐삐 시뮬레이터 v2.0)

림버스 컴퍼니(Limbus Company)의 관리자 단테 PDA/삐삐 컨셉을 차용한 반응형 일정 알리미 & 시뮬레이터 애플리케이션입니다.

---

## ✨ 주요 기능

- **반응형 모던 UI**: 창 크기 및 화면 비율 변경에 따라 유연하게 늘어나는 Flexbox 레이아웃 (Flet / Flutter 기반)
- **단테 삐삐 비주얼 & 사운드**:
  - Neo둥근모 픽셀 폰트 적용
  - 사이언 / 앰버 네온 테마 & CRT 감성
  - 비프음 재생 및 점진적 텍스트 복호화(Decryption) 애니메이션
- **Google Calendar 실시간 연동**:
  - 비공개 iCal(ICS) 주소를 통해 오늘의 일정을 자동으로 가져와 3단계(`STAGE 1~3`)로 균등 분할
  - 10분, 30분, 1시간 단위 주기적 백그라운드 자동 동기화
- **환경 설정 (Settings Modal)**:
  - 구글 캘린더 ICS URL 입력 및 즉시 동기화 테스트
  - 비프음 볼륨 조절 슬라이더 및 테스트 재생
  - 자동 동기화 주기 설정
  - 모든 설정값은 로컬 `config.json`에 영구 보관

---

## 🎮 조작법 (단축키)

| 단축키 | 동작 |
| :--- | :--- |
| **SPACE / ENTER** | 다음 단계로 진행 (대기 → 비프 → 디코딩 → 해금 → CLEAR) |
| **R** | 현재 단계 다시 재생 |
| **S** | 환경 설정 다이얼로그 열기 |

---

## 🚀 실행 방법

### 1. 가상환경 세팅 및 패키지 설치
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 앱 실행
```bash
python main.py
```

---

## 📁 프로젝트 구조

```plaintext
limbus_beep_app/
├── assets/
│   ├── neodgm.ttf            # Neo둥근모 픽셀 폰트
│   └── beep.wav              # 비프음 오디오 파일
├── core/
│   ├── audio_manager.py      # 비프음 및 사운드 관리자
│   ├── calendar_sync.py      # Google Calendar ICS 파싱 및 단계별 일정 분배
│   ├── cipher_engine.py      # 암호문 생성 및 복호화 텍스트 글리치 엔진
│   └── config_manager.py     # config.json 로드/저장/관리
├── ui/
│   ├── theme.py              # 단테 테마 컬러 & 폰트 스타일
│   ├── pager_view.py         # 반응형 삐삐 터미널 뷰 & 타임라인 패널
│   └── settings_dialog.py    # 볼륨, ICS URL, 자동 동기화 모달 창
├── main.py                   # 메인 애플리케이션 진입점
├── requirements.txt
└── .gitignore
```

---

## 🔗 GitHub 배포 안내 (Ice-Moca 계정)

GitHub에서 `Ice-Moca/limbus_beep_app` 이름으로 빈 레포지토리를 생성하신 후 아래 명령어를 실행하면 바로 푸시할 수 있습니다.

```bash
git init
git branch -M main
git add .
git commit -m "feat: Initial commit for Limbus Beep App v2.0 with responsive UI"
git remote add origin https://github.com/Ice-Moca/limbus_beep_app.git
git push -u origin main
```
