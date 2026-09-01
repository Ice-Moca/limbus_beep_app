from __future__ import annotations
import os
import sys
import threading
import time
import flet as ft

from core.config_manager import (
    BASE_DIR, CONFIG_FILE, MESSAGES_FILE,
    load_config, save_config, get_setting, set_setting
)
from core.calendar_sync import (
    load_cached_messages, sync_calendar
)
from core.audio_manager import AudioManager
from ui.theme import apply_app_theme, FONT_FAMILY, CYAN_PRIMARY, AMBER_ACCENT
from ui.settings_dialog import SettingsDialog
from ui.pager_view import PagerView

def main(page: ft.Page):
    # 1. 테마 적용
    apply_app_theme(page)

    # 2. 리소스 및 설정 로드
    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
    current_config = load_config()

    # 3. 오디오 관리자 초기화
    audio_mgr = AudioManager(assets_dir)
    audio_mgr.set_volume(current_config.get("volume", 80))

    # 4. 메시지 데이터 로드
    messages_data = load_cached_messages(MESSAGES_FILE)

    # 5. 알림 스낵바 표시 헬퍼
    def show_toast(text: str, is_success: bool = True):
        snack = ft.SnackBar(
            content=ft.Text(
                text,
                color=ft.Colors.BLACK if is_success else ft.Colors.WHITE,
                font_family=FONT_FAMILY,
                weight=ft.FontWeight.BOLD,
            ),
            bgcolor=CYAN_PRIMARY if is_success else ft.Colors.RED_600,
            duration=3000,
        )
        if hasattr(page, "open"):
            page.open(snack)
        else:
            page.overlay.append(snack)
            snack.open = True
            page.update()

    # 6. 캘린더 동기화 액션
    def do_sync_calendar(custom_url: str = None):
        url = custom_url or current_config.get("ics_url", "")
        if not url:
            show_toast("설정(S)에서 Google Calendar iCal URL을 먼저 등록해주세요.", is_success=False)
            return False

        success, msg, stages = sync_calendar(url, MESSAGES_FILE)
        show_toast(msg, is_success=success)
        if success and stages:
            pager_view.update_messages(stages)
            return True
        return False

    # 7. 설정 저장 콜백
    def on_settings_saved(new_config: dict):
        nonlocal current_config
        current_config = new_config
        save_config(new_config)
        audio_mgr.set_volume(new_config.get("volume", 80))
        show_toast("설정이 성공적으로 저장되었습니다.")

    # 8. 비프음 테스트 콜백
    def on_test_beep(vol: int):
        audio_mgr.set_volume(vol)
        audio_mgr.play_beep()

    # 9. 설정 다이얼로그 및 삐삐 뷰 생성
    settings_dialog = SettingsDialog(
        page=page,
        initial_config=current_config,
        on_save_callback=on_settings_saved,
        on_test_beep_callback=on_test_beep,
        on_sync_callback=lambda url: do_sync_calendar(url),
    )

    pager_view = PagerView(
        page=page,
        audio_manager=audio_mgr,
        messages=messages_data,
        on_open_settings_callback=lambda: settings_dialog.open(current_config),
        on_sync_callback=lambda: do_sync_calendar(),
    )

    # 10. 키보드 단축키 핸들러
    def handle_keyboard(e: ft.KeyboardEvent):
        # 설정 다이얼로그가 열려있을 때는 단축키 비활성화
        if settings_dialog.dialog.open:
            return

        key_lower = e.key.lower() if e.key else ""
        if e.key in [" ", "Space", "Enter"]:
            pager_view.advance()
        elif key_lower == "r":
            pager_view.replay()
        elif key_lower == "s":
            settings_dialog.open(current_config)

    page.on_keyboard_event = handle_keyboard

    # 11. 백그라운드 자동 동기화 타이머
    def auto_sync_worker():
        while True:
            interval_min = current_config.get("sync_interval_min", 60)
            time.sleep(max(60, interval_min * 60))
            if current_config.get("auto_sync", True) and current_config.get("ics_url"):
                try:
                    success, msg, stages = sync_calendar(current_config["ics_url"], MESSAGES_FILE)
                    if success and stages:
                        pager_view.update_messages(stages)
                except Exception as ex:
                    print(f"자동 동기화 오류: {ex}")

    sync_thread = threading.Thread(target=auto_sync_worker, daemon=True)
    sync_thread.start()

    # 12. 전체 레이아웃 렌더링
    page.add(pager_view.get_layout())

if __name__ == "__main__":
    ft.app(target=main, assets_dir="assets")
