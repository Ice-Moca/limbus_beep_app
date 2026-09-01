#!/bin/bash
set -e

echo "🔨 Limbus Beep App 빌드 시작 (macOS .app 번들)..."

# PyInstaller를 이용해 macOS .app 번들 생성
./venv/bin/pyinstaller --noconfirm --onedir --windowed \
    --name "LimbusBeep" \
    --add-data "assets:assets" \
    --add-data "index.html:." \
    --add-data "style.css:." \
    --add-data "app.js:." \
    --hidden-import "webview" \
    main.py

cd dist
rm -f LimbusBeep-macOS.zip
zip -r LimbusBeep-macOS.zip LimbusBeep.app

echo "✅ 빌드 완료! 생성 위치: dist/LimbusBeep.app & dist/LimbusBeep-macOS.zip"
