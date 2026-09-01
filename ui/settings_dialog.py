import flet as ft
from ui.theme import (
    FONT_FAMILY, CYAN_PRIMARY, CYAN_ACCENT, CYAN_DIM, CYAN_DARK,
    CARD_BG, CARD_BORDER, AMBER_ACCENT, TEXT_MUTED, TEXT_PRIMARY, TEXT_SUCCESS
)

class SettingsDialog:
    """탭 기반 고급 설정 모달 다이얼로그"""
    def __init__(self, page: ft.Page, initial_config: dict, on_save_callback, on_test_beep_callback, on_sync_callback):
        self.page = page
        self.config = initial_config.copy()
        self.on_save = on_save_callback
        self.on_test_beep = on_test_beep_callback
        self.on_sync = on_sync_callback

        # ── 탭 1: iCal (ICS) 주소 연동 ──
        self.ics_input = ft.TextField(
            label="Google Calendar 비공개 iCal(ICS) 주소",
            value=self.config.get("ics_url", ""),
            hint_text="https://calendar.google.com/calendar/ical/.../basic.ics",
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            text_size=12,
            dense=True,
            expand=True,
        )

        self.sync_button = ft.ElevatedButton(
            text="즉시 동기화",
            icon=ft.Icons.SYNC,
            style=ft.ButtonStyle(
                color=ft.Colors.BLACK,
                bgcolor=AMBER_ACCENT,
                text_style=ft.TextStyle(font_family=FONT_FAMILY, size=12, weight=ft.FontWeight.BOLD),
            ),
            on_click=self._handle_sync_click,
        )

        tab_ics = ft.Container(
            padding=ft.padding.all(12),
            content=ft.Column(
                [
                    ft.Text("📅 Google Calendar 비공개 iCal 주소 연동", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Text(
                        "Google Calendar 설정 > 캘린더 설정 > 'iCal 형식의 비공개 주소'를 복사하여 아래에 붙여넣습니다.",
                        size=11, color=TEXT_MUTED, font_family=FONT_FAMILY
                    ),
                    ft.Row([self.ics_input, self.sync_button], alignment=ft.MainAxisAlignment.SPACE_BETWEEN, spacing=8),
                    ft.Container(
                        bgcolor="#091017",
                        padding=10,
                        border_radius=6,
                        content=ft.Text(
                            "💡 Tip: 별도의 Google Cloud 콘솔 설정 없이 비공개 URL만으로 가장 간편하고 안전하게 실시간 일정을 동기화할 수 있습니다.",
                            size=11, color=AMBER_ACCENT, font_family=FONT_FAMILY
                        )
                    )
                ],
                spacing=10,
            )
        )

        # ── 탭 2: Google OAuth 직접 연동 ──
        self.client_id_input = ft.TextField(
            label="Google OAuth Client ID",
            value=self.config.get("google_client_id", ""),
            hint_text="xxxxx.apps.googleusercontent.com",
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            text_size=12,
            dense=True,
        )
        self.client_secret_input = ft.TextField(
            label="Google OAuth Client Secret",
            value=self.config.get("google_client_secret", ""),
            password=True,
            can_reveal_password=True,
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            text_size=12,
            dense=True,
        )

        tab_oauth = ft.Container(
            padding=ft.padding.all(12),
            content=ft.Column(
                [
                    ft.Text("🔑 Google Cloud OAuth 2.0 직접 연동 (고급)", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Text(
                        "Google Cloud Console에서 생성한 OAuth 클라이언트 정보를 입력하여 구글 계정으로 직접 캘린더를 연동합니다.",
                        size=11, color=TEXT_MUTED, font_family=FONT_FAMILY
                    ),
                    self.client_id_input,
                    self.client_secret_input,
                    ft.Container(
                        bgcolor="#091017",
                        padding=10,
                        border_radius=6,
                        content=ft.Text(
                            "🌐 OAuth 리다이렉트 URI: http://localhost:8080\n권한 스코프: https://www.googleapis.com/auth/calendar.readonly",
                            size=10, color=CYAN_DIM, font_family=FONT_FAMILY
                        )
                    )
                ],
                spacing=10,
            )
        )

        # ── 탭 3: 볼륨 및 자동화 설정 ──
        current_volume = self.config.get("volume", 80)
        self.volume_label = ft.Text(f"{current_volume}%", size=13, color=CYAN_PRIMARY, font_family=FONT_FAMILY)
        self.volume_slider = ft.Slider(
            min=0, max=100, divisions=20,
            value=current_volume,
            active_color=CYAN_PRIMARY,
            inactive_color=CYAN_DIM,
            on_change=self._handle_volume_change,
            expand=True,
        )
        self.test_beep_btn = ft.IconButton(
            icon=ft.Icons.VOLUME_UP,
            icon_color=CYAN_PRIMARY,
            tooltip="비프음 테스트",
            on_click=lambda e: self.on_test_beep(int(self.volume_slider.value)),
        )

        self.auto_sync_switch = ft.Switch(
            label="주기적 자동 캘린더 동기화",
            value=self.config.get("auto_sync", True),
            active_color=CYAN_PRIMARY,
        )

        self.interval_dropdown = ft.Dropdown(
            label="동기화 주기",
            width=130,
            options=[
                ft.dropdown.Option("10", "10분마다"),
                ft.dropdown.Option("30", "30분마다"),
                ft.dropdown.Option("60", "1시간마다"),
                ft.dropdown.Option("120", "2시간마다"),
            ],
            value=str(self.config.get("sync_interval_min", 60)),
            border_color=CYAN_DIM,
            focused_border_color=CYAN_PRIMARY,
            dense=True,
        )

        tab_general = ft.Container(
            padding=ft.padding.all(12),
            content=ft.Column(
                [
                    ft.Text("🔊 사운드 볼륨", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Row([
                        self.volume_slider,
                        self.volume_label,
                        self.test_beep_btn
                    ], alignment=ft.MainAxisAlignment.CENTER),
                    ft.Divider(color=CARD_BORDER),
                    ft.Text("⏱️ 백그라운드 자동화", size=13, weight=ft.FontWeight.BOLD, color=CYAN_PRIMARY, font_family=FONT_FAMILY),
                    ft.Row([
                        self.auto_sync_switch,
                        self.interval_dropdown
                    ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                ],
                spacing=10,
            )
        )

        # 탭 뷰 구성
        self.tabs = ft.Tabs(
            selected_index=0,
            animation_duration=200,
            indicator_color=CYAN_PRIMARY,
            label_color=CYAN_PRIMARY,
            unselected_label_color=TEXT_MUTED,
            tabs=[
                ft.Tab(text="iCal 연동", icon=ft.Icons.CALENDAR_MONTH, content=tab_ics),
                ft.Tab(text="Google OAuth", icon=ft.Icons.LOCK, content=tab_oauth),
                ft.Tab(text="일반 / 볼륨", icon=ft.Icons.TUNE, content=tab_general),
            ],
            expand=True,
        )

        self.dialog = ft.AlertDialog(
            modal=True,
            bgcolor=CARD_BG,
            shape=ft.RoundedRectangleBorder(radius=8),
            title=ft.Row([
                ft.Icon(ft.Icons.SETTINGS, color=CYAN_PRIMARY, size=24),
                ft.Text("단테 삐삐 환경 설정", size=17, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY, font_family=FONT_FAMILY),
            ]),
            content=ft.Container(
                width=560,
                height=340,
                content=self.tabs,
            ),
            actions=[
                ft.TextButton(
                    "취소",
                    style=ft.ButtonStyle(color=TEXT_MUTED),
                    on_click=self.close
                ),
                ft.ElevatedButton(
                    "저장",
                    icon=ft.Icons.CHECK,
                    style=ft.ButtonStyle(
                        color=ft.Colors.BLACK,
                        bgcolor=CYAN_PRIMARY,
                        text_style=ft.TextStyle(font_family=FONT_FAMILY, weight=ft.FontWeight.BOLD),
                    ),
                    on_click=self._handle_save_click
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )

    def _handle_volume_change(self, e):
        vol = int(self.volume_slider.value)
        self.volume_label.value = f"{vol}%"
        self.page.update()

    def _handle_sync_click(self, e):
        url = self.ics_input.value.strip()
        self.on_sync(url)

    def _handle_save_click(self, e):
        self.config["ics_url"] = self.ics_input.value.strip()
        self.config["google_client_id"] = self.client_id_input.value.strip()
        self.config["google_client_secret"] = self.client_secret_input.value.strip()
        self.config["volume"] = int(self.volume_slider.value)
        self.config["auto_sync"] = self.auto_sync_switch.value
        self.config["sync_interval_min"] = int(self.interval_dropdown.value or 60)
        self.on_save(self.config)
        self.close(e)

    def open(self, current_config: dict = None):
        if current_config:
            self.config = current_config.copy()
            self.ics_input.value = self.config.get("ics_url", "")
            self.client_id_input.value = self.config.get("google_client_id", "")
            self.client_secret_input.value = self.config.get("google_client_secret", "")
            self.volume_slider.value = self.config.get("volume", 80)
            self.volume_label.value = f"{int(self.volume_slider.value)}%"
            self.auto_sync_switch.value = self.config.get("auto_sync", True)
            self.interval_dropdown.value = str(self.config.get("sync_interval_min", 60))
        
        if self.dialog not in self.page.overlay:
            self.page.overlay.append(self.dialog)
        self.dialog.open = True
        self.page.update()

    def close(self, e=None):
        self.dialog.open = False
        self.page.update()
