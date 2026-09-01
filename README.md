# 📟 Limbus Beep App (단테 삐삐 Android APK & Web)

림버스 컴퍼니(Limbus Company)의 관리자 단테 PDA/삐삐 컨셉을 완벽 재현한 **안드로이드 네이티브 앱 & 웹 시뮬레이터**입니다.

[![Release](https://img.shields.io/github/v/release/Ice-Moca/limbus_beep_app?color=00e5ff&label=Android%20APK)](https://github.com/Ice-Moca/limbus_beep_app/releases/latest)

---

## 📱 안드로이드 APK 다운로드

스마트폰에 설치하여 바로 사용하실 수 있는 **5.7MB 초경량 네이티브 앱**입니다.

* 📥 **[최신 APK 다운로드 (v2.0.0)](https://github.com/Ice-Moca/limbus_beep_app/releases/download/v2.0.0/LimbusBeep-v2.0.0.apk)**
* 📥 **[항상 최신 APK 링크](https://github.com/Ice-Moca/limbus_beep_app/releases/download/v2.0.0/LimbusBeep-v2.0-latest.apk)**

---

## ✨ 주요 기능

1. **인게임 원본 삐삐 비주얼 & 사운드**:
   - 오리지널 단테 일렉트릭 블루(`#2fbffc`) 폰트 및 딥 블랙(`#000000`) 배경 기본 탑재
   - Neo둥근모 레트로 픽셀 폰트 & CRT 스캔라인/비네팅 효과
   - 비프음 재생 및 점진적 텍스트 복호화(Decryption) 연출
   - 최종 단계 완료 시 깔끔한 `_ALL_CLEAR._` 단독 연출

2. **Google 캘린더 iCal 1초 연동**:
   - Google 캘린더의 **'iCal 비공개 주소'**로 오늘 일정을 자동으로 가져와 3단계(`STAGE 1~3`)로 자동 분할
   - 복잡한 로그인이나 권한 승인 에러 없이 100% 즉시 동기화

3. **단계별 개별 메시지 카드 편집**:
   - 각 STAGE 내 세부 일정 메시지를 개별 카드 형태로 자유롭게 추가/수정/삭제
   - 유저가 커스텀한 모든 일정 및 메시지는 로컬에 영구 보존

4. **자유로운 화면 & 색상 커스텀**:
   - **화면 방향**: 가로 모드(기본), 세로 모드, 자동 회전
   - **글자 색상 & 배경 색상**: 원클릭 프리셋 칩 + 1,600만 컬러 피커 직접 선택 지원

---

## 🎮 조작법

- **화면 터치 / SPACE / ENTER**: 다음 메시지 복호화 진행 (`대기` ➔ `비프` ➔ `복호화` ➔ `완료` ➔ `_CLEAR._` ➔ `_ALL_CLEAR._`)
- **R**: 현재 메시지 다시 재생
- **S / 우측 상단 [SETTING]**: 환경 설정 창 열기

---

## 🛠️ Android APK 빌드 방법

```bash
# 원클릭 안드로이드 APK 빌드
./build_android.sh
```
빌드된 APK는 `dist/LimbusBeep-v2.0-latest.apk`에 생성됩니다.
