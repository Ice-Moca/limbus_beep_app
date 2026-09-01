#!/bin/bash
set -e

echo "🤖 Android APK 빌드 시작..."

# 1. 최신 웹 에셋을 Android assets 디렉토리로 동기화
mkdir -p android/app/src/main/assets/assets
cp index.html android/app/src/main/assets/index.html
cp style.css android/app/src/main/assets/style.css
cp app.js android/app/src/main/assets/app.js
cp -r assets/* android/app/src/main/assets/assets/

# 2. Gradle을 통한 APK 컴파일
cd android
export JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/Users/yeoeunsu/Library/Android/sdk
/Users/yeoeunsu/.gradle/wrapper/dists/gradle-8.11.1-all/2qik7nd48slq1ooc2496ixf4i/gradle-8.11.1/bin/gradle assembleDebug

# 3. dist 디렉토리로 복사
cd ..
mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk dist/LimbusBeep-v2.0-latest.apk
cp android/app/build/outputs/apk/debug/app-debug.apk dist/LimbusBeep-v2.0-arm64-debug.apk
cp android/app/build/outputs/apk/debug/app-debug.apk dist/LimbusBeep-v2.0-universal-debug.apk

echo "✅ Android APK 빌드 완료! 생성 위치: dist/LimbusBeep-v2.0-latest.apk (5.7MB)"
