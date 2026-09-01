#!/bin/bash
set -e

echo "🔨 Limbus Beep App 빌드 시작 (macOS .app 번들)..."

# PyInstaller를 이용해 macOS .app 번들 생성
./venv/bin/pyinstaller --noconfirm --onedir --windowed \
    --name "LimbusBeep" \
    --add-data "assets:assets" \
    --hidden-import "flet" \
    --hidden-import "pygame" \
    main.py

echo "✅ 빌드 완료! 생성 위치: dist/LimbusBeep.app"
