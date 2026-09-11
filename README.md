# Limbus Beep App (단테 삐삐 Android APK & Web)

림버스 컴퍼니(Limbus Company)의 관리자 단테 PDA/삐삐 컨셉을 완벽 재현한 **안드로이드 네이티브 앱 & 웹 시뮬레이터**입니다.

[![Release](https://img.shields.io/github/v/release/Ice-Moca/limbus_beep_app?color=00e5ff&label=Android%20APK)](https://github.com/Ice-Moca/limbus_beep_app/releases/latest)

---

## 안드로이드 APK 다운로드

스마트폰에 설치하여 바로 사용하실 수 있는 **6.2MB 초경량 네이티브 앱**입니다.

* **[최신 APK 다운로드 (v2.1.2)](https://github.com/Ice-Moca/limbus_beep_app/releases/download/v2.1.2/LimbusBeep-v2.1.2.apk)**
* **[항상 최신 APK 링크](https://github.com/Ice-Moca/limbus_beep_app/releases/latest/download/LimbusBeep-latest.apk)**

---

## 주요 기능

1. **인게임 원본 삐삐 비주얼 & 사운드**:
   - 오리지널 단테 일렉트릭 블루(`#2fbffc`) 폰트 및 딥 블랙(`#000000`) 배경 기본 탑재
   - Neo둥근모 레트로 픽셀 폰트 & CRT 스캔라인/비네팅 효과
   - 비프음 재생 및 점진적 텍스트 복호화(Decryption) 연출
   - 지령 수신 중 비프 애니메이션 연출

2. **Gemini API 실시간 지령 생성**:
   - 본인 Gemini API 키 입력 시 화면 터치마다 프로젝트 문 세계관의 지령 실시간 발급
   - `gemini-2.5-flash` 기본 적용 및 실시간 사용 가능 모델 목록 동적 탐색/선택 지원
   - 상황 힌트(예: 야근 중, 위기 대응 등) 반영 지원

3. **자유로운 화면 & 색상 커스텀**:
   - **화면 방향**: 가로 모드(기본), 세로 모드, 자동 회전
   - **글자 색상 & 배경 색상**: 원클릭 프리셋 칩 + 1,600만 컬러 피커 직접 선택 지원 (자동 저장 적용)
   - 가로 모드 최적화 2컬럼 레이아웃

---

## 조작법

- **화면 터치 / SPACE / ENTER**: 다음 지령 생성 및 복호화 진행 (`대기` -> `비프/수신` -> `복호화` -> `완료`)
- **R**: 현재 지령 다시 재생
- **S / 우측 상단 [SETTING]**: 환경 설정 창 열기

---

## Android APK 빌드 방법

```bash
# 원클릭 안드로이드 APK 빌드
./build.sh
# 또는
./build_android.sh
```
빌드된 APK는 `dist/LimbusBeep-latest.apk` (또는 `dist/LimbusBeep-v2.1.2.apk`)에 생성됩니다.
프로젝트 공용 서명 키(`limbus_debug.keystore`)가 포함되어 있어 언제 어디서 빌드하더라도 기존 앱과 완벽히 호환됩니다.
