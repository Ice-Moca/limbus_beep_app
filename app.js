/**
 * Limbus Beep - 단테 삐삐 시뮬레이터 v2.2.0-preview
 */

// ── 상태 정의 ──
const STATE = {
  IDLE: 'IDLE',
  BEEPING: 'BEEPING',
  DECODING: 'DECODING',
  REVEALED: 'REVEALED',
  CLEAR: 'CLEAR',
  COMPLETE: 'COMPLETE'
};

const CIPHER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+-=?<>";

// ── 기본 설정 및 초기 메시지 ──
const DEFAULT_CONFIG = {
  directive_mode: 'manual', // 'ai' 또는 'manual'
  ai_stage_count: 3,        // AI 모드 진행 단계 수 (1~5)
  gemini_api_key: '',
  gemini_hint: '',
  gemini_model: 'gemini-2.0-flash',
  volume: 80,
  orientation: 'landscape', // landscape | portrait | sensor (가로 모드 기본)
  ics_url: '',
  auto_sync_min: 60,
  decode_speed: 'normal',   // fast: 0.5s, normal: 0.9s, slow: 1.5s
  sound_type: 'file',       // file | synth
  font_color: '#2fbffc',    // 단테 블루 기본
  bg_color: '#000000',      // 딥 블랙 기본
  scanlines: true,
  vignette: true,
  alarm_enabled: true,      // 등록된 시간에 알람 울리기 (기본 활성화)
};

const DEFAULT_MESSAGES = [
  {
    stage: 1,
    messages: [
      { text: "관리자님, 오늘의 일정을 확인하십시오.", time_info: "09:00 - 10:00" },
      { text: "설정에서 구글 캘린더 iCal을 연동할 수 있습니다.", time_info: "11:00 - 12:00" }
    ]
  },
  {
    stage: 2,
    messages: [
      { text: "수감자들의 상태를 점검할 시간입니다.", time_info: "14:00 - 15:30" },
      { text: "황금가지를 향한 여정을 계속하십시오.", time_info: "16:00 - 18:00" }
    ]
  },
  {
    stage: 3,
    messages: [
      { text: "오늘 하루도 수고하셨습니다.", time_info: "20:00 - 21:00" }
    ]
  }
];

class PagerApp {
  constructor() {
    this.state = STATE.IDLE;
    this.currentStageIdx = 0;
    this.currentMsgIdx = 0;
    this.pendingAiMessage = '';
    
    this.config = this.loadConfig();
    this.messages = this.loadStoredMessages();
    this.customStages = JSON.parse(JSON.stringify(this.messages));
    
    this.animInterval = null;
    this.beepTimeout = null;
    this.audioCtx = null;
    this.todayKey = this.getTodayKey();
    this.calendarStages = this.loadCalendarStages();
    this.firedAlarms = this.loadFiredAlarms(this.todayKey);
    this.pendingAlarmTarget = null;
    this._keyDebounce = null;
    
    this.initDOM();
    this.initCustomColorPicker();
    this.bindEvents();
    this.applySettings();
    this.startClock();
    this.updateDisplay();
    this.startAlarmWatcher();
    this.scheduleAlarms();

    // 초기 자동 동기화
    if (this.config.ics_url && this.config.auto_sync_min > 0) {
      setTimeout(() => this.syncCalendar(this.config.ics_url, true), 3000);
      setInterval(() => {
        if (this.config.ics_url && this.config.auto_sync_min > 0) {
          this.syncCalendar(this.config.ics_url, true);
        }
      }, this.config.auto_sync_min * 60 * 1000);
    }
  }

  // ── DOM 캐싱 ──
  initDOM() {
    this.dom = {
      app: document.getElementById('pager-app'),
      displayDots: document.getElementById('display-dots'),
      displaySubLabel: document.getElementById('display-sub-label'),
      displayMain: document.getElementById('display-main'),
      displayTime: document.getElementById('display-time'),
      progressBar: document.getElementById('progress-container'),
      progressFill: document.getElementById('progress-fill'),
      clock: document.getElementById('clock-display'),
      
      btnOpenSettings: document.getElementById('btn-open-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnCancelSettings: document.getElementById('btn-cancel-settings'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      btnResetDefault: document.getElementById('btn-reset-default'),
      modal: document.getElementById('settings-modal'),

      // 모드 및 지령 설정 DOM
      toggleDirectiveMode: document.getElementById('toggle-directive-mode'),
      badgeCurrentMode: document.getElementById('badge-current-mode'),
      cardAiConfig: document.getElementById('card-ai-config'),
      cardManualConfig: document.getElementById('card-manual-config'),

      // Gemini AI 설정 DOM
      inputGeminiKey: document.getElementById('input-gemini-key'),
      btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
      iconKeyVisibility: document.getElementById('icon-key-visibility'),
      btnTestGemini: document.getElementById('btn-test-gemini'),
      aiTestResult: document.getElementById('ai-test-result'),
      aiStatusIndicator: document.getElementById('ai-status-indicator'),
      selectGeminiModel: document.getElementById('select-gemini-model'),
      btnRefreshModels: document.getElementById('btn-refresh-models'),
      inputGeminiHint: document.getElementById('input-gemini-hint'),
      btnAiStageDec: document.getElementById('btn-ai-stage-dec'),
      btnAiStageInc: document.getElementById('btn-ai-stage-inc'),
      labelAiStageCount: document.getElementById('label-ai-stage-count'),

      // 인앱 알람 배너 DOM
      alarmBanner: document.getElementById('alarm-banner'),
      alarmTimeText: document.getElementById('alarm-time-text'),
      alarmDescText: document.getElementById('alarm-desc-text'),
      btnAlarmJump: document.getElementById('btn-alarm-jump'),
      btnAlarmDismiss: document.getElementById('btn-alarm-dismiss'),
      toggleAlarm: document.getElementById('toggle-alarm'),

      // 캘린더 동기화 DOM
      inputIcsUrl: document.getElementById('input-ics-url'),
      btnSyncNow: document.getElementById('btn-sync-now'),
      btnDisconnectCal: document.getElementById('btn-disconnect-cal'),
      calendarStatusBadge: document.getElementById('calendar-status-badge'),
      calendarPriorityNotice: document.getElementById('calendar-priority-notice'),
      selectAutoSync: document.getElementById('select-auto-sync'),

      // STAGE 수동 메시지 관리 DOM
      stageCardsContainer: document.getElementById('stage-cards-container'),
      btnAddStage: document.getElementById('btn-add-stage'),
      btnLoadSample: document.getElementById('btn-load-sample'),
      btnClearMessages: document.getElementById('btn-clear-messages'),
      btnApplyCustom: document.getElementById('btn-apply-custom-messages'),
      labelCustomStageCount: document.getElementById('label-custom-stage-count'),

      // 화면 및 사운드 설정 DOM
      selectOrientation: document.getElementById('select-orientation'),
      selectDecodeSpeed: document.getElementById('select-decode-speed'),
      toggleScanlines: document.getElementById('toggle-scanlines'),
      toggleVignette: document.getElementById('toggle-vignette'),
      sliderVolume: document.getElementById('slider-volume'),
      labelVolume: document.getElementById('label-volume'),
      btnTestSound: document.getElementById('btn-test-sound'),
      selectSoundType: document.getElementById('select-sound-type'),
      colorChips: document.querySelectorAll('.color-circle-chip'),
      btnOpenColorPickerFont: document.getElementById('btn-open-color-picker-font'),
      btnOpenColorPickerBg: document.getElementById('btn-open-color-picker-bg'),

      // 컬러 피커 모달
      colorModal: document.getElementById('custom-color-modal'),
      btnCloseColorModal: document.getElementById('btn-close-color-modal'),
      btnCancelColorModal: document.getElementById('btn-cancel-color-modal'),
      btnApplyColorModal: document.getElementById('btn-apply-color-modal'),
      colorModalTitle: document.getElementById('color-modal-title'),
      pickerSvBox: document.getElementById('picker-sv-box'),
      pickerSvCursor: document.getElementById('picker-sv-cursor'),
      pickerHueTrack: document.getElementById('picker-hue-track'),
      pickerHueThumb: document.getElementById('picker-hue-thumb'),
      pickerLiveSwatch: document.getElementById('picker-live-swatch'),
      pickerHexInput: document.getElementById('picker-hex-input'),
      pickerRInput: document.getElementById('picker-r-input'),
      pickerGInput: document.getElementById('picker-g-input'),
      pickerBInput: document.getElementById('picker-b-input'),
      quickPresetGrid: document.getElementById('quick-preset-grid'),
      
      audio: document.getElementById('beep-audio'),
      toast: document.getElementById('toast'),
      crtOverlay: document.getElementById('crt-overlay'),
      crtVignette: document.getElementById('crt-vignette'),
      tabBtns: document.querySelectorAll('.tab-btn'),
      tabPanes: document.querySelectorAll('.tab-pane'),
    };
  }

  // ── 이벤트 바인딩 ──
  bindEvents() {
    // 1. 화면 클릭 / 터치로 다음 단계 진행
    this.dom.app.addEventListener('click', (e) => {
      if (e.target.closest('#btn-open-settings') || e.target.closest('#alarm-banner') || !this.dom.modal.classList.contains('hidden') || (this.dom.colorModal && !this.dom.colorModal.classList.contains('hidden'))) {
        return;
      }
      this.advance();
    });

    // 1-1. 인앱 알람 배너 액션 버튼
    if (this.dom.btnAlarmJump) {
      this.dom.btnAlarmJump.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pendingAlarmTarget) {
          this.jumpToMessage(this.pendingAlarmTarget.stageIdx, this.pendingAlarmTarget.msgIdx);
        } else {
          this.dismissAlarmBanner();
        }
      });
    }

    if (this.dom.btnAlarmDismiss) {
      this.dom.btnAlarmDismiss.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissAlarmBanner();
      });
    }

    // 2. 키보드 단축키
    window.addEventListener('keydown', (e) => {
      if (!this.dom.modal.classList.contains('hidden') || (this.dom.colorModal && !this.dom.colorModal.classList.contains('hidden'))) {
        if (e.key === 'Escape') {
          if (this.dom.colorModal && !this.dom.colorModal.classList.contains('hidden')) {
            this.closeColorModal();
          } else {
            this.closeModal();
          }
        }
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.advance();
      } else if (e.key.toLowerCase() === 'r') {
        this.replay();
      } else if (e.key.toLowerCase() === 's') {
        this.openModal();
      }
    });

    // 3. 설정 모달 열기/닫기
    this.dom.btnOpenSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal();
    });

    this.dom.btnCloseSettings.addEventListener('click', () => this.closeModal());
    this.dom.btnCancelSettings.addEventListener('click', () => this.closeModal());
    this.dom.modal.addEventListener('click', (e) => {
      if (e.target === this.dom.modal) this.closeModal();
    });

    // 4. 모달 탭 전환
    this.dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.tabBtns.forEach(b => b.classList.remove('active'));
        this.dom.tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPane = document.getElementById(btn.dataset.tab);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // 4-1. 지령 발급 모드 토글 (AI 실시간 vs 수동/캘린더)
    if (this.dom.toggleDirectiveMode) {
      this.dom.toggleDirectiveMode.addEventListener('change', (e) => {
        const isAi = e.target.checked;
        this.config.directive_mode = isAi ? 'ai' : 'manual';
        this.saveConfig({ directive_mode: this.config.directive_mode });
        this.updateDirectiveModeUI(isAi);
        this.updateDisplay();
        this.showToast(isAi ? "AI 실시간 지령 생성 모드가 활성화되었습니다." : "수동 / 캘린더 모드가 활성화되었습니다.");
      });
    }

    // 4-2. Gemini API Key 변경 및 비밀번호 보기/숨기기 토글
    if (this.dom.btnToggleKeyVisibility && this.dom.inputGeminiKey) {
      this.dom.btnToggleKeyVisibility.addEventListener('click', () => {
        const isPassword = this.dom.inputGeminiKey.type === 'password';
        this.dom.inputGeminiKey.type = isPassword ? 'text' : 'password';
        if (this.dom.iconKeyVisibility) {
          this.dom.iconKeyVisibility.textContent = isPassword ? 'HIDE' : 'SHOW';
        }
      });
    }

    if (this.dom.inputGeminiKey) {
      const handleKeyUpdate = (e) => {
        const key = e.target.value.trim();
        this.config.gemini_api_key = key;
        this.saveConfig({ gemini_api_key: key });
        this.updateModelSelectState();
        if (key.length > 15) {
          this.fetchAvailableModels(key);
        }
      };
      this.dom.inputGeminiKey.addEventListener('change', handleKeyUpdate);
      this.dom.inputGeminiKey.addEventListener('input', (e) => {
        clearTimeout(this._keyDebounce);
        this._keyDebounce = setTimeout(() => handleKeyUpdate(e), 500);
      });
    }

    // 4-3. Gemini API 연결 테스트 버튼
    if (this.dom.btnTestGemini) {
      this.dom.btnTestGemini.addEventListener('click', () => {
        this.testGeminiConnection();
      });
    }

    // 4-4. Gemini 모델 변경
    if (this.dom.selectGeminiModel) {
      this.dom.selectGeminiModel.addEventListener('change', (e) => {
        this.config.gemini_model = e.target.value;
        this.saveConfig({ gemini_model: e.target.value });
      });
    }

    // 4-5. Gemini 모델 목록 새로고침
    if (this.dom.btnRefreshModels) {
      this.dom.btnRefreshModels.addEventListener('click', async () => {
        const key = (this.config.gemini_api_key || '').trim();
        if (!key || key.length < 10) {
          this.showToast("API 키를 먼저 입력해주세요.");
          return;
        }
        this.dom.btnRefreshModels.disabled = true;
        this.dom.btnRefreshModels.textContent = "조회 중...";
        await this.fetchAvailableModels(key);
        this.dom.btnRefreshModels.disabled = false;
        this.dom.btnRefreshModels.textContent = "목록 새로고침";
        this.showToast("지원되는 모델 목록을 새로고침했습니다.");
      });
    }

    // 4-6. Gemini 상황 힌트 입력
    if (this.dom.inputGeminiHint) {
      this.dom.inputGeminiHint.addEventListener('change', (e) => {
        this.config.gemini_hint = e.target.value.trim();
        this.saveConfig({ gemini_hint: this.config.gemini_hint });
      });
    }

    // 4-7. AI 모드 진행 단계 (STAGE) 수 Stepper
    if (this.dom.btnAiStageDec) {
      this.dom.btnAiStageDec.addEventListener('click', (e) => {
        e.stopPropagation();
        let count = this.config.ai_stage_count || 3;
        if (count > 1) {
          count--;
          this.config.ai_stage_count = count;
          this.saveConfig({ ai_stage_count: count });
          if (this.dom.labelAiStageCount) {
            this.dom.labelAiStageCount.textContent = `${count} STAGES`;
          }
        }
      });
    }

    if (this.dom.btnAiStageInc) {
      this.dom.btnAiStageInc.addEventListener('click', (e) => {
        e.stopPropagation();
        let count = this.config.ai_stage_count || 3;
        if (count < 5) {
          count++;
          this.config.ai_stage_count = count;
          this.saveConfig({ ai_stage_count: count });
          if (this.dom.labelAiStageCount) {
            this.dom.labelAiStageCount.textContent = `${count} STAGES`;
          }
        }
      });
    }

    // 5. 화면 방향 즉시 적용
    this.dom.selectOrientation.addEventListener('change', (e) => {
      this.applyOrientation(e.target.value);
      this.saveConfig({ orientation: e.target.value });
    });

    // 6. 볼륨 슬라이더
    this.dom.sliderVolume.addEventListener('input', (e) => {
      this.dom.labelVolume.textContent = `${e.target.value}%`;
      this.config.volume = parseInt(e.target.value, 10);
      this.saveConfig({ volume: this.config.volume });
    });

    // 7. 사운드 테스트
    this.dom.btnTestSound.addEventListener('click', () => {
      this.playBeepSound();
    });

    // 8. 캘린더 수동 동기화 및 연동 해제
    if (this.dom.btnSyncNow) {
      this.dom.btnSyncNow.addEventListener('click', () => {
        const url = this.dom.inputIcsUrl.value.trim();
        if (!url) {
          this.showToast("iCal 주소를 입력해주세요.");
          return;
        }
        this.config.ics_url = url;
        this.saveConfig({ ics_url: url });
        this.syncCalendar(url, false);
      });
    }

    if (this.dom.btnDisconnectCal) {
      this.dom.btnDisconnectCal.addEventListener('click', () => {
        this.config.ics_url = '';
        this.saveConfig({ ics_url: '' });
        this.saveCalendarStages(null);
        if (this.dom.inputIcsUrl) this.dom.inputIcsUrl.value = '';
        this.updateCalendarStatusUI();
        this.updateDisplay();
        this.scheduleAlarms();
        this.showToast("캘린더 연동이 해제되었습니다. 지령 설정이 적용됩니다.");
      });
    }

    // 9. 설정 저장
    this.dom.btnSaveSettings.addEventListener('click', () => {
      this.saveSettingsFromModal();
    });

    // 10. 기본값 초기화
    this.dom.btnResetDefault.addEventListener('click', () => {
      this.resetToDefaults();
    });

    // 11. 원클릭 색상 프리셋 칩 클릭 (자동 저장 적용)
    this.dom.colorChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const color = e.target.dataset.color;
        if (!type || !color) return;

        if (type === 'font') {
          this.config.font_color = color;
          this.applyCustomColors(color, this.config.bg_color);
          this.saveConfig({ font_color: color });
        } else if (type === 'bg') {
          this.config.bg_color = color;
          this.applyCustomColors(this.config.font_color, color);
          this.saveConfig({ bg_color: color });
        }
      });
    });

    // 12. CRT 스캔라인 & 비네팅 토글 (자동 저장 적용)
    if (this.dom.toggleScanlines) {
      this.dom.toggleScanlines.addEventListener('change', (e) => {
        this.config.scanlines = e.target.checked;
        if (this.dom.crtOverlay) {
          this.dom.crtOverlay.style.display = e.target.checked ? 'block' : 'none';
        }
        this.updateMiniCrtPreview();
        this.saveConfig({ scanlines: e.target.checked });
      });
    }

    if (this.dom.toggleVignette) {
      this.dom.toggleVignette.addEventListener('change', (e) => {
        this.config.vignette = e.target.checked;
        if (this.dom.crtVignette) {
          this.dom.crtVignette.style.display = e.target.checked ? 'block' : 'none';
        }
        this.updateMiniCrtPreview();
        this.saveConfig({ vignette: e.target.checked });
      });
    }

    // 12-1. 일정 알람 토글
    if (this.dom.toggleAlarm) {
      this.dom.toggleAlarm.addEventListener('change', (e) => {
        this.config.alarm_enabled = e.target.checked;
        this.saveConfig({ alarm_enabled: e.target.checked });
        this.scheduleAlarms();
      });
    }

    // 13. STAGE 동적 제어 버튼
    this.dom.btnAddStage.addEventListener('click', () => {
      this.syncCustomBufferFromDOM();
      const newStageNum = this.customStages.length + 1;
      this.customStages.push({
        stage: newStageNum,
        messages: [{ text: `새로운 지령 메시지`, time_info: "" }]
      });
      this.renderCustomStageCards();
      this.showToast(`STAGE ${newStageNum} 추가됨`);
    });

    this.dom.btnLoadSample.addEventListener('click', () => {
      if (confirm("기본 예시 STAGE로 덮어쓰시겠습니까?")) {
        this.customStages = JSON.parse(JSON.stringify(DEFAULT_MESSAGES));
        this.renderCustomStageCards();
        this.showToast("기본 예시 불러오기 완료");
      }
    });

    this.dom.btnClearMessages.addEventListener('click', () => {
      if (confirm("모든 STAGE 메시지를 비우시겠습니까?")) {
        this.customStages = [{
          stage: 1,
          messages: [{ text: "", time_info: "" }]
        }];
        this.renderCustomStageCards();
        this.showToast("STAGE가 비워졌습니다.");
      }
    });

    // 14. 작성된 STAGE 삐삐 적용
    this.dom.btnApplyCustom.addEventListener('click', () => this.applyCustomStages());
  }

  // ── 설정 로드 및 저장 ──
  loadConfig() {
    try {
      const stored = localStorage.getItem('limbus_beep_config');
      const parsed = stored ? JSON.parse(stored) : {};
      const config = { ...DEFAULT_CONFIG, ...parsed };
      if (!parsed.directive_mode) {
        config.directive_mode = 'manual';
      }
      if (!parsed.ai_stage_count) {
        config.ai_stage_count = 3;
      }
      if (!config.gemini_model || config.gemini_model.includes('2.5')) {
        config.gemini_model = 'gemini-2.0-flash';
      }
      return config;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('limbus_beep_config', JSON.stringify(this.config));
    this.applySettings();
  }

  loadStoredMessages() {
    try {
      const stored = localStorage.getItem('limbus_beep_messages');
      return stored ? JSON.parse(stored) : DEFAULT_MESSAGES;
    } catch {
      return DEFAULT_MESSAGES;
    }
  }

  saveStoredMessages(messages) {
    this.messages = messages;
    this.customStages = JSON.parse(JSON.stringify(messages));
    localStorage.setItem('limbus_beep_messages', JSON.stringify(messages));
    this.currentStageIdx = 0;
    this.currentMsgIdx = 0;
    this.updateDisplay();
    this.renderCustomStageCards();
    this.scheduleAlarms();
  }

  // ── 캘린더 연동 데이터 관리 (최우선 적용) ──
  loadCalendarStages() {
    try {
      const stored = localStorage.getItem('limbus_beep_calendar_stages');
      const date = localStorage.getItem('limbus_beep_calendar_date');
      if (date && date !== this.todayKey) {
        localStorage.removeItem('limbus_beep_calendar_stages');
        return null;
      }
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  saveCalendarStages(stages) {
    this.calendarStages = stages;
    if (stages && stages.length > 0) {
      localStorage.setItem('limbus_beep_calendar_stages', JSON.stringify(stages));
      localStorage.setItem('limbus_beep_calendar_date', this.todayKey);
    } else {
      localStorage.removeItem('limbus_beep_calendar_stages');
      localStorage.removeItem('limbus_beep_calendar_date');
    }
    this.currentStageIdx = 0;
    this.currentMsgIdx = 0;
    this.updateCalendarStatusUI();
    this.updateDisplay();
    this.scheduleAlarms();
  }

  isCalendarActive() {
    return !!(this.config.ics_url && this.config.ics_url.trim().length > 0 && this.calendarStages && this.calendarStages.length > 0);
  }

  getActiveStages() {
    if (this.isCalendarActive()) {
      return this.calendarStages;
    }
    return this.messages || DEFAULT_MESSAGES;
  }

  updateCalendarStatusUI() {
    const isCalActive = this.isCalendarActive();
    if (this.dom.calendarStatusBadge) {
      if (isCalActive) {
        const count = this.calendarStages.reduce((acc, s) => acc + (s.messages ? s.messages.length : 0), 0);
        this.dom.calendarStatusBadge.textContent = `연동됨 (${count}개 일정)`;
        this.dom.calendarStatusBadge.className = 'status-badge-cyber active';
      } else if (this.config.ics_url && this.config.ics_url.trim().length > 0) {
        this.dom.calendarStatusBadge.textContent = '일정 없음';
        this.dom.calendarStatusBadge.className = 'status-badge-cyber';
      } else {
        this.dom.calendarStatusBadge.textContent = '미연동';
        this.dom.calendarStatusBadge.className = 'status-badge-cyber';
      }
    }
    if (this.dom.btnDisconnectCal) {
      this.dom.btnDisconnectCal.style.display = (this.config.ics_url && this.config.ics_url.trim().length > 0) ? 'inline-block' : 'none';
    }
    if (this.dom.calendarPriorityNotice) {
      this.dom.calendarPriorityNotice.classList.toggle('hidden', !isCalActive);
      this.dom.calendarPriorityNotice.style.display = isCalActive ? 'block' : 'none';
    }
  }

  applyCustomColors(fontColor, bgColor) {
    const fc = (fontColor || this.config.font_color || '#2fbffc').toUpperCase();
    const bc = (bgColor || this.config.bg_color || '#000000').toUpperCase();

    document.documentElement.style.setProperty('--cyan-primary', fc);
    document.documentElement.style.setProperty('--cyan-accent', fc);
    document.documentElement.style.setProperty('--cyan-dim', `${fc}88`);
    document.documentElement.style.setProperty('--cyan-glow', `${fc}88`);
    document.documentElement.style.setProperty('--bg-color', bc);
    document.body.style.backgroundColor = bc;
    if (this.dom.app) this.dom.app.style.backgroundColor = bc;

    const miniPreview = document.getElementById('theme-mini-preview');
    const miniText = document.getElementById('mini-preview-text');
    const tagFontHex = document.getElementById('tag-font-hex');
    const tagBgHex = document.getElementById('tag-bg-hex');

    if (miniPreview) miniPreview.style.backgroundColor = bc;
    if (miniText) {
      miniText.style.color = fc;
      miniText.style.textShadow = `0 0 10px ${fc}88`;
    }
    if (tagFontHex) tagFontHex.textContent = fc;
    if (tagBgHex) tagBgHex.textContent = bc;

    let fontPresetMatched = false;
    document.querySelectorAll('.color-circle-chip[data-type="font"][data-color]').forEach(chip => {
      const isMatch = chip.dataset.color.toUpperCase() === fc;
      chip.classList.toggle('active', isMatch);
      if (isMatch) fontPresetMatched = true;
    });
    if (this.dom.btnOpenColorPickerFont) {
      this.dom.btnOpenColorPickerFont.classList.toggle('active', !fontPresetMatched);
    }

    let bgPresetMatched = false;
    document.querySelectorAll('.color-circle-chip[data-type="bg"][data-color]').forEach(chip => {
      const isMatch = chip.dataset.color.toUpperCase() === bc;
      chip.classList.toggle('active', isMatch);
      if (isMatch) bgPresetMatched = true;
    });
    if (this.dom.btnOpenColorPickerBg) {
      this.dom.btnOpenColorPickerBg.classList.toggle('active', !bgPresetMatched);
    }

    this.updateMiniCrtPreview();
  }

  updateMiniCrtPreview() {
    const miniScan = document.getElementById('mini-crt-scanlines');
    const miniVig = document.getElementById('mini-crt-vignette');
    const isScanOn = this.dom.toggleScanlines ? this.dom.toggleScanlines.checked : this.config.scanlines;
    const isVigOn = this.dom.toggleVignette ? this.dom.toggleVignette.checked : (this.config.vignette !== false);

    if (miniScan) {
      miniScan.style.display = isScanOn ? 'block' : 'none';
      miniScan.classList.toggle('hidden', !isScanOn);
    }
    if (miniVig) {
      miniVig.style.display = isVigOn ? 'block' : 'none';
      miniVig.classList.toggle('hidden', !isVigOn);
    }
  }

  applyOrientation(mode) {
    const targetMode = mode || this.config.orientation || 'landscape';
    if (window.AndroidBridge && typeof window.AndroidBridge.setOrientation === 'function') {
      window.AndroidBridge.setOrientation(targetMode);
    }
    try {
      if (screen.orientation && screen.orientation.lock) {
        if (targetMode === 'landscape') screen.orientation.lock('landscape').catch(() => {});
        else if (targetMode === 'portrait') screen.orientation.lock('portrait').catch(() => {});
        else if (targetMode === 'sensor') screen.orientation.unlock();
      }
    } catch (e) {}
  }

  applySettings() {
    if (this.dom.crtOverlay) {
      this.dom.crtOverlay.style.display = this.config.scanlines ? 'block' : 'none';
    }
    if (this.dom.crtVignette) {
      this.dom.crtVignette.style.display = (this.config.vignette !== false) ? 'block' : 'none';
    }
    this.applyCustomColors(this.config.font_color, this.config.bg_color);
    this.applyOrientation(this.config.orientation || 'landscape');
    this.updateCalendarStatusUI();
    this.scheduleAlarms();
  }

  // ── 일정 알람 스케줄링 & 감시 엔진 ──
  getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  loadFiredAlarms(todayKey) {
    try {
      const stored = localStorage.getItem(`limbus_fired_alarms_${todayKey}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  saveFiredAlarms(todayKey) {
    try {
      localStorage.setItem(`limbus_fired_alarms_${todayKey}`, JSON.stringify(Array.from(this.firedAlarms)));
    } catch {}
  }

  scheduleAlarms() {
    const isEnabled = this.config.alarm_enabled !== false;
    if (!isEnabled || (!this.isCalendarActive() && this.config.directive_mode === 'ai')) {
      if (window.AndroidBridge && typeof window.AndroidBridge.cancelAllAlarms === 'function') {
        window.AndroidBridge.cancelAllAlarms();
      }
      return;
    }

    const now = new Date();
    const alarmsList = [];
    const stages = this.getActiveStages();

    stages.forEach((stage, sIdx) => {
      if (!stage.messages) return;
      stage.messages.forEach((msg, mIdx) => {
        const match = (msg.time_info || '').match(/\b(\d{1,2}):(\d{2})\b/);
        if (!match) return;

        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

        if (triggerDate.getTime() > now.getTime()) {
          alarmsList.push({
            id: alarmsList.length + 1,
            title: "단테 삐삐 일정 알람",
            message: msg.text,
            time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
            triggerAtMillis: triggerDate.getTime()
          });
        }
      });
    });

    if (window.AndroidBridge && typeof window.AndroidBridge.scheduleAlarms === 'function') {
      try {
        window.AndroidBridge.scheduleAlarms(JSON.stringify(alarmsList));
      } catch (err) {
        console.error("Alarm scheduling error:", err);
      }
    }
  }

  startAlarmWatcher() {
    setInterval(() => {
      this.checkAlarms();
    }, 10000);
  }

  checkAlarms() {
    if (this.config.alarm_enabled === false) return;
    if (!this.isCalendarActive() && this.config.directive_mode === 'ai') return;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const todayKey = this.getTodayKey();

    if (todayKey !== this.todayKey) {
      this.todayKey = todayKey;
      this.firedAlarms = this.loadFiredAlarms(todayKey);
    }

    const stages = this.getActiveStages();
    stages.forEach((stage, sIdx) => {
      if (!stage.messages) return;
      stage.messages.forEach((msg, mIdx) => {
        const match = (msg.time_info || '').match(/\b(\d{1,2}):(\d{2})\b/);
        if (!match) return;

        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);

        if (currentHours === hours && currentMinutes === minutes) {
          const alarmKey = `${todayKey}_${sIdx}_${mIdx}_${hours}:${minutes}`;
          if (!this.firedAlarms.has(alarmKey)) {
            this.firedAlarms.add(alarmKey);
            this.saveFiredAlarms(todayKey);
            this.triggerInAppAlarm(msg.time_info, msg.text, sIdx, mIdx);
          }
        }
      });
    });
  }

  triggerInAppAlarm(timeStr, descStr, stageIdx, msgIdx) {
    this.playBeepSound();
    
    if (navigator.vibrate) {
      try { navigator.vibrate([200, 100, 200]); } catch (e) {}
    }

    if (this.dom.alarmBanner) {
      this.pendingAlarmTarget = { stageIdx, msgIdx };
      this.dom.alarmTimeText.textContent = timeStr || "알람";
      this.dom.alarmDescText.textContent = descStr || "등록된 일정 시간입니다.";
      this.dom.alarmBanner.classList.remove('hidden');

      if (this.alarmBannerTimer) clearTimeout(this.alarmBannerTimer);
      this.alarmBannerTimer = setTimeout(() => {
        this.dismissAlarmBanner();
      }, 15000);
    }
  }

  jumpToMessage(stageIdx, msgIdx) {
    this.dismissAlarmBanner();
    this.currentStageIdx = stageIdx;
    this.currentMsgIdx = msgIdx;
    this.startBeeping();
  }

  dismissAlarmBanner() {
    if (this.dom.alarmBanner) {
      this.dom.alarmBanner.classList.add('hidden');
    }
    this.pendingAlarmTarget = null;
    if (this.alarmBannerTimer) {
      clearTimeout(this.alarmBannerTimer);
      this.alarmBannerTimer = null;
    }
  }

  // ── 오디오 재생 ──
  playBeepSound() {
    const vol = (this.config.volume || 80) / 100;
    if (vol <= 0) return;

    if (this.config.sound_type === 'synth') {
      this.playSynthTone(vol);
    } else {
      if (this.dom.audio) {
        this.dom.audio.volume = vol;
        this.dom.audio.currentTime = 0;
        this.dom.audio.play().catch(() => {
          this.playSynthTone(vol);
        });
      } else {
        this.playSynthTone(vol);
      }
    }
  }

  playSynthTone(vol) {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(vol * 0.4, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.2);
    } catch (e) {}
  }

  // ── 데이터 헬퍼 ──
  truncateText(text, maxLen = 30) {
    if (!text) return "";
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  }

  getCurrentStage() {
    const stages = this.getActiveStages();
    if (!stages || stages.length === 0) return null;
    return stages[this.currentStageIdx] || stages[0];
  }

  getCurrentMessage() {
    const stage = this.getCurrentStage();
    if (!stage || !stage.messages) return null;
    const msg = stage.messages[this.currentMsgIdx] || null;
    if (!msg) return null;
    return {
      ...msg,
      text: this.truncateText(msg.text, 30)
    };
  }

  getRandomCipher(len = 10) {
    let res = "";
    for (let i = 0; i < len; i++) {
      res += CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
    }
    return res;
  }

  // ── 상태 머신 컨트롤 ──
  advance() {
    this.clearTimers();

    // 1. 캘린더 연동 활성화 상태 (어떤 지령 모드보다 캘린더 일정이 항상 최우선)
    if (this.isCalendarActive()) {
      const stages = this.calendarStages;
      const stage = this.getCurrentStage();

      if (this.state === STATE.IDLE) {
        this.currentStageIdx = 0;
        this.currentMsgIdx = 0;
        this.startBeeping();
      } else if (this.state === STATE.BEEPING) {
        this.startDecoding();
      } else if (this.state === STATE.DECODING) {
        this.startRevealed();
      } else if (this.state === STATE.REVEALED) {
        if (stage && this.currentMsgIdx + 1 < stage.messages.length) {
          this.currentMsgIdx++;
          this.startBeeping();
        } else {
          const isLastStage = (this.currentStageIdx + 1 >= stages.length);
          if (isLastStage) {
            this.startComplete();
          } else {
            this.startClear();
          }
        }
      } else if (this.state === STATE.CLEAR) {
        this.currentStageIdx++;
        this.currentMsgIdx = 0;
        this.startBeeping();
      } else if (this.state === STATE.COMPLETE) {
        this.currentStageIdx = 0;
        this.currentMsgIdx = 0;
        this.startIdle();
      }
      return;
    }

    // 2. 캘린더 미연동 상태: 지령 설정(AI 모드 vs 수동 모드) 적용
    if (this.config.directive_mode === 'ai') {
      // ── AI 실시간 생성 모드 ──
      const apiKey = (this.config.gemini_api_key || "").trim();
      if (!apiKey || apiKey.length < 10) {
        this.showToast("설정에서 Gemini API 키를 먼저 입력해주세요.");
        this.openModal();
        return;
      }

      const totalAiStages = this.config.ai_stage_count || 3;

      if (this.state === STATE.IDLE) {
        this.currentStageIdx = 0;
        this.startAiBeeping();
      } else if (this.state === STATE.BEEPING) {
        // AI 응답 대기 중
      } else if (this.state === STATE.DECODING) {
        if (this.pendingAiMessage) {
          this.startAiRevealed(this.pendingAiMessage);
        }
      } else if (this.state === STATE.REVEALED) {
        if (this.currentStageIdx + 1 < totalAiStages) {
          this.startClear();
        } else {
          this.startComplete();
        }
      } else if (this.state === STATE.CLEAR) {
        this.currentStageIdx++;
        this.startAiBeeping();
      } else if (this.state === STATE.COMPLETE) {
        this.currentStageIdx = 0;
        this.startIdle();
      }
    } else {
      // ── 수동 / 캘린더 모드 (기존 STAGE 순차 진행) ──
      const stages = this.messages;
      const stage = this.getCurrentStage();

      if (this.state === STATE.IDLE) {
        this.currentMsgIdx = 0;
        this.startBeeping();
      } else if (this.state === STATE.BEEPING) {
        this.startDecoding();
      } else if (this.state === STATE.DECODING) {
        this.startRevealed();
      } else if (this.state === STATE.REVEALED) {
        if (stage && this.currentMsgIdx + 1 < stage.messages.length) {
          this.currentMsgIdx++;
          this.startBeeping();
        } else {
          const isLastStage = (this.currentStageIdx + 1 >= stages.length);
          if (isLastStage) {
            this.startComplete();
          } else {
            this.startClear();
          }
        }
      } else if (this.state === STATE.CLEAR) {
        this.currentStageIdx++;
        this.currentMsgIdx = 0;
        this.startBeeping();
      } else if (this.state === STATE.COMPLETE) {
        this.currentStageIdx = 0;
        this.currentMsgIdx = 0;
        this.startIdle();
      }
    }
  }

  replay() {
    this.clearTimers();
    if (this.isCalendarActive()) {
      if (this.state === STATE.REVEALED || this.state === STATE.DECODING) {
        this.startDecoding();
      } else {
        this.startBeeping();
      }
    } else if (this.config.directive_mode === 'ai') {
      if (this.pendingAiMessage) {
        this.startAiDecoding(this.pendingAiMessage);
      } else {
        this.startAiBeeping();
      }
    } else {
      if (this.state === STATE.REVEALED || this.state === STATE.DECODING) {
        this.startDecoding();
      } else {
        this.startBeeping();
      }
    }
  }

  clearTimers() {
    if (this.animInterval) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    }
    if (this.beepTimeout) {
      clearTimeout(this.beepTimeout);
      this.beepTimeout = null;
    }
  }

  // ── 상태 0: IDLE ──
  startIdle() {
    this.state = STATE.IDLE;
    this.clearTimers();
    this.updateDisplay();
  }

  // ── AI 모드 상태 제어 ──
  startAiBeeping() {
    this.state = STATE.BEEPING;
    this.clearTimers();
    this.playBeepSound();

    const stageNum = this.currentStageIdx + 1;
    this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // 지령 수신 중...`;
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayMain.className = 'main-text dimmed';

    let dots = 0;
    this.dom.displayDots.textContent = "";
    this.animInterval = setInterval(() => {
      dots = (dots + 1) % 5;
      this.dom.displayDots.textContent = "•".repeat(dots);
      this.dom.displayMain.textContent = this.getRandomCipher(12);
    }, 150);

    const minDur = (this.config.decode_speed === 'fast') ? 800 : (this.config.decode_speed === 'slow') ? 1800 : 1200;
    const minWaitPromise = new Promise(resolve => setTimeout(resolve, minDur));
    const fetchPromise = this.generateGeminiMessage(this.config.gemini_hint);

    Promise.all([minWaitPromise, fetchPromise])
      .then(([_, directiveText]) => {
        if (this.state !== STATE.BEEPING) return;
        this.pendingAiMessage = directiveText;
        this.startAiDecoding(directiveText);
      })
      .catch((err) => {
        if (this.state !== STATE.BEEPING) return;
        this.clearTimers();
        this.dom.displayDots.textContent = "";
        const curStage = this.currentStageIdx + 1;
        this.dom.displaySubLabel.textContent = `STAGE ${curStage} // 지령 수신 실패`;
        this.dom.displayMain.textContent = "통신 에러 // 터치하여 재시도";
        this.dom.displayMain.className = 'main-text amber';
        this.state = STATE.IDLE;
        this.showToast(err.message || "Gemini 지령 생성에 실패했습니다.");
      });
  }

  startAiDecoding(targetText) {
    this.state = STATE.DECODING;
    this.clearTimers();

    const stageNum = this.currentStageIdx + 1;
    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // DECRYPTING...`;
    this.dom.progressBar.classList.add('visible');
    this.dom.displayTime.classList.remove('visible');

    const totalSteps = (this.config.decode_speed === 'fast') ? 8 : (this.config.decode_speed === 'slow') ? 18 : 12;
    let currentStep = 0;

    this.animInterval = setInterval(() => {
      currentStep++;
      const progress = currentStep / totalSteps;
      const revealedLength = Math.floor(targetText.length * progress);
      const revealedPart = targetText.slice(0, revealedLength);
      const cipherPart = this.getRandomCipher(Math.max(0, targetText.length - revealedLength));

      this.dom.displayMain.textContent = revealedPart + cipherPart;
      this.dom.displayMain.className = (progress > 0.6) ? 'main-text accent' : 'main-text dimmed';
      this.dom.progressFill.style.width = `${progress * 100}%`;

      if (currentStep >= totalSteps) {
        clearInterval(this.animInterval);
        this.startAiRevealed(targetText);
      }
    }, (this.config.decode_speed === 'fast') ? 40 : (this.config.decode_speed === 'slow') ? 90 : 60);
  }

  startAiRevealed(targetText) {
    this.state = STATE.REVEALED;
    this.clearTimers();

    const stageNum = this.currentStageIdx + 1;
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // 지령 수신 완료`;
    this.dom.displayMain.textContent = targetText;
    this.dom.displayMain.className = 'main-text accent';
    this.dom.displayTime.classList.remove('visible');
  }

  // ── 수동 / 캘린더 모드 상태 1: BEEPING ──
  startBeeping() {
    this.state = STATE.BEEPING;
    this.clearTimers();
    this.playBeepSound();

    const stage = this.getCurrentStage();
    const stageNum = stage ? stage.stage : 1;
    const msg = this.getCurrentMessage();
    const targetText = msg ? msg.text : "NO DATA";

    this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // BEEPING...`;
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayMain.className = 'main-text dimmed';

    let dots = 0;
    this.dom.displayDots.textContent = "";
    this.animInterval = setInterval(() => {
      dots = (dots + 1) % 5;
      this.dom.displayDots.textContent = "•".repeat(dots);
      this.dom.displayMain.textContent = this.getRandomCipher(Math.min(targetText.length, 12));
    }, 150);

    const beepDur = (this.config.decode_speed === 'fast') ? 1000 : (this.config.decode_speed === 'slow') ? 2200 : 1600;
    this.beepTimeout = setTimeout(() => {
      this.startDecoding();
    }, beepDur);
  }

  // ── 수동 모드 상태 2: DECODING ──
  startDecoding() {
    this.state = STATE.DECODING;
    this.clearTimers();

    const stage = this.getCurrentStage();
    const stageNum = stage ? stage.stage : 1;
    const msg = this.getCurrentMessage();
    const targetText = msg ? msg.text : "NO DATA";

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // DECRYPTING...`;
    this.dom.progressBar.classList.add('visible');
    this.dom.displayTime.classList.remove('visible');

    const totalSteps = (this.config.decode_speed === 'fast') ? 8 : (this.config.decode_speed === 'slow') ? 20 : 14;
    let currentStep = 0;

    this.animInterval = setInterval(() => {
      currentStep++;
      const progress = currentStep / totalSteps;
      const revealedLength = Math.floor(targetText.length * progress);
      const revealedPart = targetText.slice(0, revealedLength);
      const cipherPart = this.getRandomCipher(targetText.length - revealedLength);

      this.dom.displayMain.textContent = revealedPart + cipherPart;
      this.dom.displayMain.className = (progress > 0.6) ? 'main-text accent' : 'main-text dimmed';
      this.dom.progressFill.style.width = `${progress * 100}%`;

      if (currentStep >= totalSteps) {
        clearInterval(this.animInterval);
        this.startRevealed();
      }
    }, (this.config.decode_speed === 'fast') ? 40 : (this.config.decode_speed === 'slow') ? 90 : 60);
  }

  // ── 수동 모드 상태 3: REVEALED ──
  startRevealed() {
    this.state = STATE.REVEALED;
    this.clearTimers();

    const stage = this.getCurrentStage();
    const stageNum = stage ? stage.stage : 1;
    const msg = this.getCurrentMessage();

    this.dom.progressBar.classList.remove('visible');
    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // MESSAGE ${this.currentMsgIdx + 1}/${stage ? stage.messages.length : 1}`;
    this.dom.displayMain.textContent = msg ? msg.text : "NO DATA";
    this.dom.displayMain.className = 'main-text accent';

    if (msg && msg.time_info) {
      this.dom.displayTime.textContent = msg.time_info;
      this.dom.displayTime.classList.add('visible');
    } else {
      this.dom.displayTime.classList.remove('visible');
    }
  }

  // ── 수동 모드 상태 4: CLEAR ──
  startClear() {
    this.state = STATE.CLEAR;
    this.clearTimers();

    const stageNum = this.currentStageIdx + 1;
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // COMPLETE`;
    this.dom.displayMain.textContent = "_CLEAR._";
    this.dom.displayMain.className = 'main-text amber';
  }

  // ── 수동 모드 상태 5: COMPLETE ──
  startComplete() {
    this.state = STATE.COMPLETE;
    this.clearTimers();

    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "ALL SCHEDULES COMPLETED";
    this.dom.displayMain.textContent = "_ALL_CLEAR._";
    this.dom.displayMain.className = 'main-text amber';
  }

  updateDisplay() {
    if (this.state === STATE.IDLE) {
      this.dom.displayDots.textContent = "";
      const stageNum = this.currentStageIdx + 1;
      if (this.isCalendarActive()) {
        this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // CALENDAR SYNC`;
        this.dom.displayMain.textContent = "SPACE 또는 터치하여 시작";
      } else if (this.config.directive_mode === 'ai') {
        this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // DIRECTIVE READY`;
        this.dom.displayMain.textContent = "SPACE 또는 터치하여 지령 수신";
      } else {
        this.dom.displaySubLabel.textContent = `STAGE ${stageNum} // READY`;
        this.dom.displayMain.textContent = "SPACE 또는 터치하여 시작";
      }
      this.dom.displayMain.className = 'main-text';
      this.dom.displayTime.classList.remove('visible');
      this.dom.progressBar.classList.remove('visible');
    }
  }

  // ── 시계 ──
  startClock() {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      if (this.dom.clock) {
        this.dom.clock.textContent = `${h}:${m}:${s}`;
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  // ── 설정 모달 열기/닫기 ──
  openModal() {
    // 캘린더 연동 탭을 기본 첫 번째 탭으로 활성화
    if (this.dom.tabBtns && this.dom.tabPanes) {
      this.dom.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'tab-calendar'));
      this.dom.tabPanes.forEach(p => p.classList.toggle('active', p.id === 'tab-calendar'));
    }

    this.updateCalendarStatusUI();

    const isAi = (this.config.directive_mode === 'ai');
    this.updateDirectiveModeUI(isAi);

    if (this.dom.inputGeminiKey) {
      this.dom.inputGeminiKey.value = this.config.gemini_api_key || '';
    }
    if (this.dom.inputGeminiHint) {
      this.dom.inputGeminiHint.value = this.config.gemini_hint || '';
    }
    if (this.dom.selectGeminiModel) {
      this.dom.selectGeminiModel.value = this.config.gemini_model || 'gemini-2.0-flash';
    }
    if (this.dom.aiTestResult) {
      this.dom.aiTestResult.textContent = '';
      this.dom.aiTestResult.className = 'cyber-field-hint';
    }

    this.dom.selectOrientation.value = this.config.orientation || 'landscape';
    this.dom.inputIcsUrl.value = this.config.ics_url || '';
    this.dom.sliderVolume.value = this.config.volume;
    this.dom.labelVolume.textContent = `${this.config.volume}%`;
    this.dom.selectAutoSync.value = String(this.config.auto_sync_min);
    this.dom.selectDecodeSpeed.value = this.config.decode_speed;
    this.dom.selectSoundType.value = this.config.sound_type || 'file';
    this.dom.toggleScanlines.checked = this.config.scanlines;
    this.dom.toggleVignette.checked = this.config.vignette !== false;
    if (this.dom.toggleAlarm) {
      this.dom.toggleAlarm.checked = this.config.alarm_enabled !== false;
    }
    this.applyCustomColors(this.config.font_color, this.config.bg_color);

    // 수동 STAGE 목록 렌더링
    this.customStages = JSON.parse(JSON.stringify(this.messages));
    this.renderCustomStageCards();

    // 모델 상태 갱신 및 유효 키 시 모델 로드
    this.updateModelSelectState();
    if (this.config.gemini_api_key && this.config.gemini_api_key.trim().length > 10) {
      this.fetchAvailableModels(this.config.gemini_api_key.trim());
    }

    this.dom.modal.classList.remove('hidden');
  }

  closeModal() {
    this.applySettings();
    this.dom.modal.classList.add('hidden');
  }

  updateDirectiveModeUI(isAi) {
    if (this.dom.toggleDirectiveMode) {
      this.dom.toggleDirectiveMode.checked = isAi;
    }
    if (this.dom.badgeCurrentMode) {
      this.dom.badgeCurrentMode.textContent = isAi ? "AI 실시간 생성" : "수동 모드";
      this.dom.badgeCurrentMode.className = `mode-state-pill ${isAi ? 'pill-ai' : 'pill-manual'}`;
    }
    if (this.dom.cardAiConfig) {
      this.dom.cardAiConfig.classList.toggle('hidden', !isAi);
      this.dom.cardAiConfig.style.display = isAi ? 'flex' : 'none';
    }
    if (this.dom.cardManualConfig) {
      this.dom.cardManualConfig.classList.toggle('hidden', isAi);
      this.dom.cardManualConfig.style.display = isAi ? 'none' : 'flex';
      if (!isAi) {
        this.renderCustomStageCards();
      }
    }
    if (this.dom.labelAiStageCount) {
      this.dom.labelAiStageCount.textContent = `${this.config.ai_stage_count || 3} STAGES`;
    }
    this.updateModelSelectState();
  }

  updateModelSelectState() {
    const hasKey = !!(this.config.gemini_api_key && this.config.gemini_api_key.trim().length > 10);
    if (this.dom.selectGeminiModel) {
      this.dom.selectGeminiModel.disabled = !hasKey;
    }
    if (this.dom.btnRefreshModels) {
      this.dom.btnRefreshModels.disabled = !hasKey;
    }
    if (this.dom.aiStatusIndicator) {
      if (hasKey) {
        this.dom.aiStatusIndicator.textContent = "API 키 등록됨";
        this.dom.aiStatusIndicator.className = "status-badge-cyber active";
      } else {
        this.dom.aiStatusIndicator.textContent = "API 키 대기 중";
        this.dom.aiStatusIndicator.className = "status-badge-cyber";
      }
    }
  }

  // ── 동적 STAGE 카드 렌더링 (각 메시지가 개별 카드로 분리됨) ──
  renderCustomStageCards() {
    if (!this.dom.stageCardsContainer) return;
    this.dom.stageCardsContainer.innerHTML = '';
    if (this.dom.labelCustomStageCount) {
      this.dom.labelCustomStageCount.textContent = `${this.customStages.length} STAGES`;
    }

    const pillClasses = ['stage-pill-cyan', 'stage-pill-amber', 'stage-pill-green'];

    this.customStages.forEach((stage, sIdx) => {
      const stageNum = sIdx + 1;
      const pillClass = pillClasses[sIdx % pillClasses.length];
      const stageCard = document.createElement('div');
      stageCard.className = 'stage-edit-card';

      const messages = stage.messages || [];

      let msgCardsHtml = '';
      messages.forEach((m, mIdx) => {
        msgCardsHtml += `
          <div class="msg-card-item" data-sidx="${sIdx}" data-midx="${mIdx}">
            <div class="msg-card-row">
              <input type="text" class="msg-time-input" data-sidx="${sIdx}" data-midx="${mIdx}" value="${m.time_info || ''}" placeholder="시간 (예: 09:00 - 10:00)">
              <button class="btn-del-msg" data-sidx="${sIdx}" data-midx="${mIdx}" title="메시지 삭제">&times;</button>
            </div>
            <input type="text" class="msg-text-input" data-sidx="${sIdx}" data-midx="${mIdx}" value="${m.text || ''}" placeholder="메시지 내용 입력">
          </div>
        `;
      });

      stageCard.innerHTML = `
        <div class="stage-edit-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="stage-pill ${pillClass}">STAGE ${stageNum}</span>
            <span class="stage-sub-hint">메시지 ${messages.length}개</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn-add-msg-to-stage btn-sm-text" data-sidx="${sIdx}">+ 메시지 추가</button>
            ${this.customStages.length > 1 ? `<button class="btn-del-stage" data-sidx="${sIdx}">삭제</button>` : ''}
          </div>
        </div>
        <div class="stage-msg-list" id="stage-msg-list-${sIdx}">
          ${msgCardsHtml || '<div class="empty-msg-notice">등록된 메시지가 없습니다. [+ 메시지 추가]를 눌러 추가하세요.</div>'}
        </div>
      `;

      const delStageBtn = stageCard.querySelector('.btn-del-stage');
      if (delStageBtn) {
        delStageBtn.addEventListener('click', (e) => {
          this.syncCustomBufferFromDOM();
          const targetIdx = parseInt(e.target.dataset.sidx, 10);
          this.customStages.splice(targetIdx, 1);
          this.renderCustomStageCards();
          this.showToast(`STAGE 삭제됨 (현재 ${this.customStages.length}개)`);
        });
      }

      const addMsgBtn = stageCard.querySelector('.btn-add-msg-to-stage');
      if (addMsgBtn) {
        addMsgBtn.addEventListener('click', (e) => {
          this.syncCustomBufferFromDOM();
          const targetSIdx = parseInt(e.target.dataset.sidx, 10);
          if (!this.customStages[targetSIdx].messages) this.customStages[targetSIdx].messages = [];
          this.customStages[targetSIdx].messages.push({ text: `새 메시지`, time_info: "" });
          this.renderCustomStageCards();
        });
      }

      stageCard.querySelectorAll('.btn-del-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.syncCustomBufferFromDOM();
          const sIdx = parseInt(e.target.dataset.sidx, 10);
          const mIdx = parseInt(e.target.dataset.midx, 10);
          this.customStages[sIdx].messages.splice(mIdx, 1);
          this.renderCustomStageCards();
        });
      });

      this.dom.stageCardsContainer.appendChild(stageCard);
    });
  }

  syncCustomBufferFromDOM() {
    if (!this.dom.stageCardsContainer) return;
    this.customStages.forEach((stage, sIdx) => {
      stage.messages = [];
      const msgItems = this.dom.stageCardsContainer.querySelectorAll(`.msg-card-item[data-sidx="${sIdx}"]`);
      msgItems.forEach(item => {
        const timeIn = item.querySelector('.msg-time-input');
        const textIn = item.querySelector('.msg-text-input');
        const timeVal = timeIn ? timeIn.value.trim() : "";
        const textVal = textIn ? textIn.value.trim() : "";
        stage.messages.push({ text: textVal, time_info: timeVal });
      });
    });
  }

  applyCustomStages() {
    this.syncCustomBufferFromDOM();

    for (let i = 0; i < this.customStages.length; i++) {
      const msgs = this.customStages[i].messages;
      if (!msgs || msgs.length === 0) {
        this.showToast(`STAGE ${i + 1}에 최소 1개 이상의 메시지를 추가해주세요.`);
        return;
      }
    }

    this.saveStoredMessages(this.customStages);
    this.closeModal();
    this.showToast("커스텀 STAGE 메시지가 적용되었습니다.");
  }

  saveSettingsFromModal() {
    this.syncCustomBufferFromDOM();
    const isAi = this.dom.toggleDirectiveMode ? this.dom.toggleDirectiveMode.checked : (this.config.directive_mode === 'ai');
    const icsUrlVal = this.dom.inputIcsUrl ? this.dom.inputIcsUrl.value.trim() : '';

    if (!icsUrlVal && this.config.ics_url) {
      this.saveCalendarStages(null);
    }
    
    const newConfig = {
      directive_mode: isAi ? 'ai' : 'manual',
      ai_stage_count: this.config.ai_stage_count || 3,
      gemini_api_key: this.dom.inputGeminiKey ? this.dom.inputGeminiKey.value.trim() : (this.config.gemini_api_key || ''),
      gemini_hint: this.dom.inputGeminiHint ? this.dom.inputGeminiHint.value.trim() : (this.config.gemini_hint || ''),
      gemini_model: this.dom.selectGeminiModel ? this.dom.selectGeminiModel.value : (this.config.gemini_model || 'gemini-2.0-flash'),
      orientation: this.dom.selectOrientation.value,
      ics_url: icsUrlVal,
      auto_sync_min: parseInt(this.dom.selectAutoSync.value, 10),
      decode_speed: this.dom.selectDecodeSpeed.value,
      volume: parseInt(this.dom.sliderVolume.value, 10),
      sound_type: this.dom.selectSoundType.value,
      scanlines: this.dom.toggleScanlines.checked,
      vignette: this.dom.toggleVignette.checked,
      alarm_enabled: this.dom.toggleAlarm ? this.dom.toggleAlarm.checked : true,
    };

    this.saveConfig(newConfig);
    this.saveStoredMessages(this.customStages);
    this.updateCalendarStatusUI();
    this.closeModal();
    this.showToast("설정이 저장되었습니다.");
  }

  resetToDefaults() {
    if (confirm("모든 설정을 기본값으로 초기화하시겠습니까?")) {
      this.saveConfig(DEFAULT_CONFIG);
      this.saveStoredMessages(DEFAULT_MESSAGES);
      this.openModal();
      this.showToast("기본값으로 복원되었습니다.");
    }
  }

  // ── Gemini AI 실시간 지령 생성 ──
  buildGeminiSingleMessageRequestBody(hint) {
    const systemPrompt = [
      "너는 '프로젝트 문(Project Moon)' 세계관(로보토미 코퍼레이션, 라이브러리 오브 루이나, 림버스 컴퍼니)에 등장하는",
      "'검지(Index)'가 단말기로 하달하는 '지령' 한 줄을 작성하는 역할이다.",
      "",
      "규칙:",
      "- 이유는 알 수 없지만 절대적으로 순응해야 하는, 서늘하고 단호한 명령조로 쓴다. (예: '~할 것.', '~하라.')",
      "- 지령 문구는 30자 이내로 간결하게 작성한다.",
      "- 실존 캐릭터 이름이나 대사를 그대로 재현하지 말고, 분위기만 차용한 창작 지령을 만든다.",
      "- 매번 새롭고 다른, 다소 황당하더라도 그럴듯한 소재로 작성한다.",
      "- 반드시 한국어로만 작성한다.",
      "- 다른 설명이나 따옴표, 마크다운 없이 지령 텍스트 하나만 출력한다."
    ].join("\n");

    let userPrompt = "위 규칙에 맞는 지령을 하나 발급하라.";
    if (hint && hint.trim()) {
      userPrompt += ` (현재 상황 참고: ${hint.trim()})`;
    }

    return {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 1.1,
        maxOutputTokens: 150
      }
    };
  }

  // ── 범용 HTTP 통신 헬퍼 (Android Native Bridge 우선, fetch 폴백) ──
  async nativeOrFetch(url, method = 'GET', body = null) {
    if (window.AndroidBridge) {
      try {
        if (method === 'POST' && typeof window.AndroidBridge.httpPost === 'function') {
          const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
          const respStr = window.AndroidBridge.httpPost(url, bodyStr);
          if (respStr && respStr.startsWith('{')) {
            const parsed = JSON.parse(respStr);
            return {
              ok: parsed.status >= 200 && parsed.status < 300,
              status: parsed.status,
              text: async () => parsed.data || '',
              json: async () => JSON.parse(parsed.data || '{}')
            };
          }
        } else if (method === 'GET' && typeof window.AndroidBridge.httpGet === 'function') {
          const respStr = window.AndroidBridge.httpGet(url);
          if (respStr && respStr.startsWith('{')) {
            const parsed = JSON.parse(respStr);
            return {
              ok: parsed.status >= 200 && parsed.status < 300,
              status: parsed.status,
              text: async () => parsed.data || '',
              json: async () => JSON.parse(parsed.data || '{}')
            };
          }
        }
      } catch (e) {
        console.warn("AndroidBridge HTTP 실패, fetch로 전환:", e);
      }
    }

    // 표준 브라우저 fetch
    const opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body && method !== 'GET') {
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return await fetch(url, opts);
  }

  async fetchAvailableModels(apiKey) {
    if (!apiKey || apiKey.trim().length < 10) return;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      const resp = await this.nativeOrFetch(url, 'GET');
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.models || !Array.isArray(data.models)) return;

      const validModels = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''))
        .filter(name => name.startsWith('gemini'));

      if (validModels.length > 0) {
        this.updateModelSelectOptions(validModels);
      }
    } catch (e) {
      console.warn("모델 목록 조회 실패:", e);
    }
  }

  updateModelSelectOptions(models) {
    if (!this.dom.selectGeminiModel) return;
    const currentVal = this.config.gemini_model || 'gemini-2.0-flash';

    const preferredOrder = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    const allModels = [
      ...preferredOrder.filter(m => models.includes(m)),
      ...models.filter(m => !preferredOrder.includes(m))
    ];

    if (allModels.length === 0) return;

    this.dom.selectGeminiModel.innerHTML = '';
    allModels.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      let label = m;
      if (m === 'gemini-2.0-flash') label = `${m} (고속 / 권장)`;
      else if (m === 'gemini-2.0-flash-lite') label = `${m} (초고속 / 경량)`;
      else if (m === 'gemini-1.5-flash') label = `${m} (안정적 표준)`;
      else if (m === 'gemini-1.5-pro') label = `${m} (심층 추론)`;
      opt.textContent = label;
      this.dom.selectGeminiModel.appendChild(opt);
    });

    if (allModels.includes(currentVal)) {
      this.dom.selectGeminiModel.value = currentVal;
    } else {
      this.dom.selectGeminiModel.value = allModels[0];
      this.config.gemini_model = allModels[0];
      this.saveConfig({ gemini_model: allModels[0] });
    }
  }

  async generateGeminiMessage(hint) {
    const apiKey = (this.config.gemini_api_key || "").trim();
    if (!apiKey || apiKey.length < 10) {
      throw new Error("Gemini API 키를 입력해주세요.");
    }

    let model = (this.config.gemini_model || "gemini-2.0-flash").trim();
    if (model.includes('2.5')) {
      model = 'gemini-2.0-flash';
    }

    const body = this.buildGeminiSingleMessageRequestBody(hint);

    // 우선 설정된 모델 호출, 404 발생 시 대체 모델 시도
    const tryModels = [model];
    if (model !== 'gemini-1.5-flash') tryModels.push('gemini-1.5-flash');
    if (model !== 'gemini-2.0-flash') tryModels.push('gemini-2.0-flash');

    let lastErrText = "";

    for (const targetModel of tryModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const resp = await this.nativeOrFetch(url, "POST", body);
        if (resp.ok) {
          const data = await resp.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            if (this.config.gemini_model !== targetModel) {
              this.config.gemini_model = targetModel;
              this.saveConfig({ gemini_model: targetModel });
              if (this.dom.selectGeminiModel) this.dom.selectGeminiModel.value = targetModel;
            }
            const cleaned = rawText.trim().replace(/^[\"\'\s]+|[\"\'\s]+$/g, "");
            return this.truncateText(cleaned, 30);
          }
        } else {
          lastErrText = await resp.text().catch(() => "");
          if (resp.status !== 404) {
            break;
          }
        }
      } catch (fetchErr) {
        lastErrText = fetchErr.message || "네트워크 오류";
      }
    }

    let parsedMsg = lastErrText;
    try {
      const errObj = JSON.parse(lastErrText);
      if (errObj?.error?.message) {
        parsedMsg = errObj.error.message;
      }
    } catch {}
    throw new Error(parsedMsg ? `${parsedMsg.slice(0, 120)}` : "지령 생성 실패");
  }

  async testGeminiConnection() {
    const apiKey = this.dom.inputGeminiKey ? this.dom.inputGeminiKey.value.trim() : (this.config.gemini_api_key || '');
    if (!apiKey || apiKey.length < 10) {
      if (this.dom.aiTestResult) {
        this.dom.aiTestResult.textContent = "API 키를 먼저 입력하세요.";
        this.dom.aiTestResult.className = "cyber-field-hint hint-error";
      }
      this.showToast("API 키를 입력하세요.");
      return;
    }

    if (this.dom.btnTestGemini) {
      this.dom.btnTestGemini.disabled = true;
      this.dom.btnTestGemini.innerHTML = "<span>확인 중...</span>";
    }
    if (this.dom.aiTestResult) {
      this.dom.aiTestResult.textContent = "Gemini API 연결 확인 중...";
      this.dom.aiTestResult.className = "cyber-field-hint";
    }

    try {
      this.config.gemini_api_key = apiKey;
      this.saveConfig({ gemini_api_key: apiKey });
      const testDirective = await this.generateGeminiMessage("테스트 지령");
      
      if (this.dom.aiTestResult) {
        this.dom.aiTestResult.textContent = `연결 성공! [지령: ${testDirective}]`;
        this.dom.aiTestResult.className = "cyber-field-hint hint-success";
      }
      if (this.dom.aiStatusIndicator) {
        this.dom.aiStatusIndicator.textContent = "정상 연결됨";
        this.dom.aiStatusIndicator.className = "status-badge-cyber active";
      }
      this.showToast("Gemini API 연결 성공!");
      await this.fetchAvailableModels(apiKey);
      this.updateModelSelectState();
    } catch (err) {
      if (this.dom.aiTestResult) {
        this.dom.aiTestResult.textContent = `연결 실패: ${err.message}`;
        this.dom.aiTestResult.className = "cyber-field-hint hint-error";
      }
      if (this.dom.aiStatusIndicator) {
        this.dom.aiStatusIndicator.textContent = "연결 오류";
        this.dom.aiStatusIndicator.className = "status-badge-cyber";
      }
      this.showToast(`연결 실패: ${err.message}`);
    } finally {
      if (this.dom.btnTestGemini) {
        this.dom.btnTestGemini.disabled = false;
        this.dom.btnTestGemini.innerHTML = "<span>연결 확인</span>";
      }
    }
  }

  // ── Google Calendar ICS 파싱 & 동기화 ──
  async syncCalendar(icsUrl, isAuto = false) {
    if (!icsUrl) return;

    if (!isAuto && this.dom.btnSyncNow) {
      this.dom.btnSyncNow.disabled = true;
      this.dom.btnSyncNow.textContent = "동기화 중...";
    }

    try {
      let icsText = null;

      // 1. Android Native HTTP Bridge 시도
      if (window.AndroidBridge && typeof window.AndroidBridge.fetchUrl === 'function') {
        try {
          const resp = window.AndroidBridge.fetchUrl(icsUrl);
          if (resp && resp.startsWith('{')) {
            const data = JSON.parse(resp);
            if (data.status === 200 && data.data) {
              icsText = data.data;
            }
          }
        } catch (e) {}
      }

      // 2. 브라우저 직접 fetch 시도
      if (!icsText) {
        try {
          const resp = await fetch(icsUrl);
          if (resp.ok) icsText = await resp.text();
        } catch (e) {}
      }

      // 3. CORS 프록시 폴백
      if (!icsText) {
        const proxies = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(icsUrl)}`,
          `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`
        ];
        for (const pUrl of proxies) {
          try {
            const resp = await fetch(pUrl);
            if (resp.ok) {
              icsText = await resp.text();
              break;
            }
          } catch (e) {}
        }
      }

      if (!icsText) {
        throw new Error("캘린더 데이터를 불러오지 못했습니다. 주소를 다시 확인해주세요.");
      }

      const events = this.parseICS(icsText);
      if (events.length === 0) {
        this.saveCalendarStages([]);
        if (!isAuto) this.showToast("오늘 예정된 일정이 없습니다.");
        return;
      }

      // 일정을 3개의 STAGE로 균등 분할
      const stages = [
        { stage: 1, messages: [] },
        { stage: 2, messages: [] },
        { stage: 3, messages: [] }
      ];

      events.forEach((evt, idx) => {
        const stageIdx = idx % 3;
        stages[stageIdx].messages.push({
          text: this.truncateText(evt.summary, 30),
          time_info: evt.timeStr || ""
        });
      });

      const filteredStages = stages.filter(s => s.messages.length > 0);
      this.saveCalendarStages(filteredStages);

      if (!isAuto) {
        this.showToast(`오늘 일정 ${events.length}개가 연동되었습니다! (최우선 적용)`);
        this.closeModal();
      }
    } catch (err) {
      console.error(err);
      if (!isAuto) this.showToast(err.message || "동기화 실패");
    } finally {
      if (!isAuto && this.dom.btnSyncNow) {
        this.dom.btnSyncNow.disabled = false;
        this.dom.btnSyncNow.textContent = "동기화";
      }
    }
  }

  // ── 한국 표준시(KST) 순수 오늘 일정 파싱 ──
  parseICS(icsText) {
    const events = [];
    const lines = icsText.split(/\r\n|\n|\r/);
    let inEvent = false;
    let currentEvent = {};

    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayY = nowKST.getUTCFullYear();
    const todayM = nowKST.getUTCMonth();
    const todayD = nowKST.getUTCDate();

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      while (i + 1 < lines.length && (lines[i + 1].startsWith(" ") || lines[i + 1].startsWith("\t"))) {
        line += lines[i + 1].slice(1);
        i++;
      }

      if (line === "BEGIN:VEVENT") {
        inEvent = true;
        currentEvent = {};
      } else if (line === "END:VEVENT") {
        inEvent = false;
        if (currentEvent.summary && currentEvent.dtstart) {
          const evtDate = this.parseICSDate(currentEvent.dtstart);
          if (evtDate) {
            const evtKST = new Date(evtDate.getTime() + 9 * 60 * 60 * 1000);
            if (
              evtKST.getUTCFullYear() === todayY &&
              evtKST.getUTCMonth() === todayM &&
              evtKST.getUTCDate() === todayD
            ) {
              let timeStr = "";
              if (!currentEvent.isAllDay) {
                const h = String(evtKST.getUTCHours()).padStart(2, '0');
                const m = String(evtKST.getUTCMinutes()).padStart(2, '0');
                timeStr = `${h}:${m}`;
                if (currentEvent.dtend) {
                  const endDate = this.parseICSDate(currentEvent.dtend);
                  if (endDate) {
                    const endKST = new Date(endDate.getTime() + 9 * 60 * 60 * 1000);
                    const eh = String(endKST.getUTCHours()).padStart(2, '0');
                    const em = String(endKST.getUTCMinutes()).padStart(2, '0');
                    timeStr += ` - ${eh}:${em}`;
                  }
                }
              } else {
                timeStr = "종일 일정";
              }

              events.push({
                summary: currentEvent.summary,
                timeStr: timeStr,
                timestamp: evtDate.getTime()
              });
            }
          }
        }
      } else if (inEvent) {
        if (line.startsWith("SUMMARY:")) {
          currentEvent.summary = line.slice(8).replace(/\\,/g, ",").replace(/\\;/g, ";");
        } else if (line.startsWith("DTSTART")) {
          const val = line.split(":")[1];
          currentEvent.dtstart = val;
          if (line.includes("VALUE=DATE") || (val && val.length === 8)) {
            currentEvent.isAllDay = true;
          }
        } else if (line.startsWith("DTEND")) {
          currentEvent.dtend = line.split(":")[1];
        }
      }
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }

  parseICSDate(dateStr) {
    if (!dateStr) return null;
    try {
      if (dateStr.length === 8) {
        const y = parseInt(dateStr.slice(0, 4), 10);
        const m = parseInt(dateStr.slice(4, 6), 10) - 1;
        const d = parseInt(dateStr.slice(6, 8), 10);
        return new Date(Date.UTC(y, m, d, 0, 0, 0));
      }
      const cleaned = dateStr.replace(/[^0-9TZ]/g, '');
      const y = parseInt(cleaned.slice(0, 4), 10);
      const m = parseInt(cleaned.slice(4, 6), 10) - 1;
      const d = parseInt(cleaned.slice(6, 8), 10);
      const h = parseInt(cleaned.slice(9, 11) || 0, 10);
      const min = parseInt(cleaned.slice(11, 13) || 0, 10);
      const s = parseInt(cleaned.slice(13, 15) || 0, 10);

      if (cleaned.endsWith('Z')) {
        return new Date(Date.UTC(y, m, d, h, min, s));
      } else {
        return new Date(y, m, d, h, min, s);
      }
    } catch {
      return null;
    }
  }

  // ── 프리미엄 사이버 컬러 피커 시스템 ──
  initCustomColorPicker() {
    this.colorPickerTarget = 'font';
    this.currentColorH = 198;
    this.currentColorS = 81;
    this.currentColorV = 99;
    this.currentColorHex = '#2FBFFC';

    let isDraggingSV = false;
    const handleSVMove = (e) => {
      if (!this.dom.pickerSvBox) return;
      const rect = this.dom.pickerSvBox.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const s = Math.round(x * 100);
      const v = Math.round((1 - y) * 100);

      this.updateColorFromHSV(this.currentColorH, s, v);
    };

    if (this.dom.pickerSvBox) {
      this.dom.pickerSvBox.addEventListener('mousedown', (e) => {
        isDraggingSV = true;
        handleSVMove(e);
      });
      this.dom.pickerSvBox.addEventListener('touchstart', (e) => {
        isDraggingSV = true;
        handleSVMove(e);
      }, { passive: true });
    }

    let isDraggingHue = false;
    const handleHueMove = (e) => {
      if (!this.dom.pickerHueTrack) return;
      const rect = this.dom.pickerHueTrack.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const h = Math.round(x * 360) % 360;

      this.updateColorFromHSV(h, this.currentColorS, this.currentColorV);
    };

    if (this.dom.pickerHueTrack) {
      this.dom.pickerHueTrack.addEventListener('mousedown', (e) => {
        isDraggingHue = true;
        handleHueMove(e);
      });
      this.dom.pickerHueTrack.addEventListener('touchstart', (e) => {
        isDraggingHue = true;
        handleHueMove(e);
      }, { passive: true });
    }

    window.addEventListener('mousemove', (e) => {
      if (isDraggingSV) handleSVMove(e);
      if (isDraggingHue) handleHueMove(e);
    });
    window.addEventListener('touchmove', (e) => {
      if (isDraggingSV) handleSVMove(e);
      if (isDraggingHue) handleHueMove(e);
    }, { passive: true });

    window.addEventListener('mouseup', () => {
      isDraggingSV = false;
      isDraggingHue = false;
    });
    window.addEventListener('touchend', () => {
      isDraggingSV = false;
      isDraggingHue = false;
    });

    if (this.dom.pickerHexInput) {
      this.dom.pickerHexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.updateColorFromHex(val);
        }
      });
    }

    const handleRGBInput = () => {
      const r = Math.min(255, Math.max(0, parseInt(this.dom.pickerRInput.value || 0, 10)));
      const g = Math.min(255, Math.max(0, parseInt(this.dom.pickerGInput.value || 0, 10)));
      const b = Math.min(255, Math.max(0, parseInt(this.dom.pickerBInput.value || 0, 10)));
      const hex = this.rgbToHex(r, g, b);
      this.updateColorFromHex(hex);
    };

    if (this.dom.pickerRInput) this.dom.pickerRInput.addEventListener('input', handleRGBInput);
    if (this.dom.pickerGInput) this.dom.pickerGInput.addEventListener('input', handleRGBInput);
    if (this.dom.pickerBInput) this.dom.pickerBInput.addEventListener('input', handleRGBInput);

    if (this.dom.btnOpenColorPickerFont) {
      this.dom.btnOpenColorPickerFont.addEventListener('click', () => {
        this.openColorModal('font');
      });
    }
    if (this.dom.btnOpenColorPickerBg) {
      this.dom.btnOpenColorPickerBg.addEventListener('click', () => {
        this.openColorModal('bg');
      });
    }

    if (this.dom.btnCloseColorModal) {
      this.dom.btnCloseColorModal.addEventListener('click', () => this.closeColorModal());
    }
    if (this.dom.btnCancelColorModal) {
      this.dom.btnCancelColorModal.addEventListener('click', () => this.closeColorModal());
    }
    if (this.dom.btnApplyColorModal) {
      this.dom.btnApplyColorModal.addEventListener('click', () => this.applySelectedCustomColor());
    }
  }

  openColorModal(target) {
    this.colorPickerTarget = target;
    const initialHex = (target === 'font') ? (this.config.font_color || '#2FBFFC') : (this.config.bg_color || '#000000');
    
    if (this.dom.colorModalTitle) {
      this.dom.colorModalTitle.textContent = (target === 'font') ? '글자 색상 직접 선택' : '배경 색상 직접 선택';
    }

    this.renderQuickPresets(target);
    this.updateColorFromHex(initialHex);

    if (this.dom.colorModal) this.dom.colorModal.classList.remove('hidden');
  }

  closeColorModal() {
    if (this.dom.colorModal) this.dom.colorModal.classList.add('hidden');
  }

  applySelectedCustomColor() {
    const selectedHex = this.currentColorHex.toUpperCase();
    if (this.colorPickerTarget === 'font') {
      this.config.font_color = selectedHex;
      this.applyCustomColors(selectedHex, this.config.bg_color);
      this.saveConfig({ font_color: selectedHex });
      this.showToast(`글자 색상 적용됨: ${selectedHex}`);
    } else {
      this.config.bg_color = selectedHex;
      this.applyCustomColors(this.config.font_color, selectedHex);
      this.saveConfig({ bg_color: selectedHex });
      this.showToast(`배경 색상 적용됨: ${selectedHex}`);
    }
    this.closeColorModal();
  }

  updateColorFromHSV(h, s, v) {
    this.currentColorH = h;
    this.currentColorS = s;
    this.currentColorV = v;

    const rgb = this.hsvToRgb(h, s, v);
    const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
    this.currentColorHex = hex;

    this.updateColorPickerUI(h, s, v, rgb, hex);
  }

  updateColorFromHex(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return;
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);

    this.currentColorH = hsv.h;
    this.currentColorS = hsv.s;
    this.currentColorV = hsv.v;
    this.currentColorHex = hex.toUpperCase();

    this.updateColorPickerUI(hsv.h, hsv.s, hsv.v, rgb, hex);
  }

  updateColorPickerUI(h, s, v, rgb, hex) {
    if (this.dom.pickerSvBox) {
      this.dom.pickerSvBox.style.backgroundColor = `hsl(${h}, 100%, 50%)`;
    }
    if (this.dom.pickerSvCursor) {
      this.dom.pickerSvCursor.style.left = `${s}%`;
      this.dom.pickerSvCursor.style.top = `${100 - v}%`;
      this.dom.pickerSvCursor.style.backgroundColor = hex;
    }
    if (this.dom.pickerHueThumb) {
      this.dom.pickerHueThumb.style.left = `${(h / 360) * 100}%`;
    }
    if (this.dom.pickerLiveSwatch) {
      this.dom.pickerLiveSwatch.style.backgroundColor = hex;
    }
    if (this.dom.pickerHexInput && document.activeElement !== this.dom.pickerHexInput) {
      this.dom.pickerHexInput.value = hex.toUpperCase();
    }
    if (this.dom.pickerRInput && document.activeElement !== this.dom.pickerRInput) {
      this.dom.pickerRInput.value = rgb.r;
    }
    if (this.dom.pickerGInput && document.activeElement !== this.dom.pickerGInput) {
      this.dom.pickerGInput.value = rgb.g;
    }
    if (this.dom.pickerBInput && document.activeElement !== this.dom.pickerBInput) {
      this.dom.pickerBInput.value = rgb.b;
    }

    if (this.dom.quickPresetGrid) {
      this.dom.quickPresetGrid.querySelectorAll('.quick-preset-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.color.toUpperCase() === hex);
      });
    }
  }

  renderQuickPresets(target) {
    if (!this.dom.quickPresetGrid) return;
    this.dom.quickPresetGrid.innerHTML = '';

    const fontPresets = [
      { name: '단테 블루', hex: '#2FBFFC' },
      { name: '황금가지', hex: '#FF9D00' },
      { name: '레트로 그린', hex: '#00E676' },
      { name: '네온 레드', hex: '#FF5252' },
      { name: '사이버 핑크', hex: '#FF4081' },
      { name: '바이올렛', hex: '#D500F9' },
      { name: '터콰이즈', hex: '#00E5FF' },
      { name: '화이트', hex: '#FFFFFF' }
    ];

    const bgPresets = [
      { name: '딥 블랙', hex: '#000000' },
      { name: '다크 네이비', hex: '#050E18' },
      { name: '다크 퍼플', hex: '#0B0412' },
      { name: '다크 올리브', hex: '#09140A' },
      { name: '다크 카민', hex: '#140508' },
      { name: '나이트 블루', hex: '#020B14' },
      { name: '옵시디언', hex: '#080808' },
      { name: '차콜', hex: '#101214' }
    ];

    const presets = (target === 'font') ? fontPresets : bgPresets;
    presets.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quick-preset-chip';
      chip.dataset.color = p.hex;
      chip.innerHTML = `
        <span class="preset-color-dot" style="background:${p.hex};"></span>
        <span class="preset-name">${p.name}</span>
      `;
      if (p.hex.toUpperCase() === this.currentColorHex) {
        chip.classList.add('active');
      }
      chip.addEventListener('click', () => {
        this.updateColorFromHex(p.hex);
      });
      this.dom.quickPresetGrid.appendChild(chip);
    });
  }

  // ── 색상 변환 헬퍼 함수 ──
  hsvToRgb(h, s, v) {
    s = s / 100;
    v = v / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r1 = 0, g1 = 0, b1 = 0;

    if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else if (h >= 300 && h < 360) { r1 = c; g1 = 0; b1 = x; }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = (max === 0) ? 0 : (d / max) * 100;
    const v = max * 100;

    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        case b: h = ((r - g) / d + 4) * 60; break;
      }
    }
    return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
  }

  rgbToHex(r, g, b) {
    const toHex = (n) => {
      const hex = Math.max(0, Math.min(255, n)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return (`#${toHex(r)}${toHex(g)}${toHex(b)}`).toUpperCase();
  }

  hexToRgb(hex) {
    const m = hex.replace('#', '').match(/.{1,2}/g);
    if (!m || m.length < 3) return null;
    return {
      r: parseInt(m[0], 16),
      g: parseInt(m[1], 16),
      b: parseInt(m[2], 16)
    };
  }

  // ── 토스트 알림 ──
  showToast(msg) {
    if (!this.dom.toast) return;
    this.dom.toast.textContent = msg;
    this.dom.toast.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, 2500);
  }
}

// ── 앱 초기화 ──
window.addEventListener('DOMContentLoaded', () => {
  window.limbusApp = new PagerApp();
});