#!/bin/bash
set -e

echo "🍎 [1/3] 웹 에셋 최신화 동기화 중..."
mkdir -p ios/LimbusBeep/www
cp index.html style.css app.js ios/LimbusBeep/www/
cp -r assets ios/LimbusBeep/www/

echo "🔨 [2/3] iOS 앱 빌드 중 (xcodebuild)..."
mkdir -p build/ios dist

# 1. iOS Simulator 빌드
xcodebuild -project ios/LimbusBeep.xcodeproj \
           -scheme LimbusBeep \
           -sdk iphonesimulator \
           -configuration Release \
           CONFIGURATION_BUILD_DIR="$(pwd)/build/ios/simulator" \
           CODE_SIGN_IDENTITY="" \
           CODE_SIGNING_REQUIRED=NO \
           CODE_SIGNING_ALLOWED=NO \
           build

# 2. Generic iOS Device 빌드 (IPA 패키징용)
xcodebuild -project ios/LimbusBeep.xcodeproj \
           -scheme LimbusBeep \
           -sdk iphoneos \
           -configuration Release \
           CONFIGURATION_BUILD_DIR="$(pwd)/build/ios/device" \
           CODE_SIGN_IDENTITY="" \
           CODE_SIGNING_REQUIRED=NO \
           CODE_SIGNING_ALLOWED=NO \
           build

echo "📦 [3/3] iOS IPA 및 시뮬레이터 번들 패키징 중..."
# Simulator App Zip
cd build/ios/simulator
zip -r -q ../../../dist/LimbusBeep-iOS-Simulator.zip LimbusBeep.app
cd ../../..

# Device IPA (Payload/LimbusBeep.app)
mkdir -p build/ios/ipa_payload/Payload
cp -r build/ios/device/LimbusBeep.app build/ios/ipa_payload/Payload/
cd build/ios/ipa_payload
zip -r -q ../../../dist/LimbusBeep-v2.0.0.ipa Payload
cp ../../../dist/LimbusBeep-v2.0.0.ipa ../../../dist/LimbusBeep-iOS-latest.ipa
cd ../../..

echo "=========================================="
echo "✅ iOS 빌드 완료!"
echo "📱 iPhone IPA (사이드로딩/AltStore용): dist/LimbusBeep-v2.0.0.ipa"
echo "💻 iOS Simulator 번들: dist/LimbusBeep-iOS-Simulator.zip"
echo "🛠️ Xcode 프로젝트: ios/LimbusBeep.xcodeproj"
echo "=========================================="
