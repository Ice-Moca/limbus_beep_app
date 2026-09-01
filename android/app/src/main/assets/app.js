/**
 * Limbus Beep - 단테 삐삐 시뮬레이터 v2.0
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
    
    this.config = this.loadConfig();
    this.messages = this.loadStoredMessages();
    this.customStages = JSON.parse(JSON.stringify(this.messages));
    
    this.animInterval = null;
    this.beepTimeout = null;
    this.audioCtx = null;
    
    this.initDOM();
    this.initCustomColorPicker();
    this.bindEvents();
    this.applySettings();
    this.startClock();
    this.updateDisplay();

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
      hintText: document.getElementById('hint-text'),
      
      // 모달 & 폼 컨트롤
      modal: document.getElementById('settings-modal'),
      btnOpenSettings: document.getElementById('btn-open-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnCancelSettings: document.getElementById('btn-cancel-settings'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      btnResetDefault: document.getElementById('btn-reset-default'),
      btnSyncNow: document.getElementById('btn-sync-now'),
      btnTestSound: document.getElementById('btn-test-sound'),
      
      // 메시지 & STAGE 조절기
      btnAddStage: document.getElementById('btn-add-stage'),
      btnLoadSample: document.getElementById('btn-load-sample'),
      btnClearMessages: document.getElementById('btn-clear-messages'),
      btnApplyCustom: document.getElementById('btn-apply-custom-messages'),
      labelCustomStageCount: document.getElementById('label-custom-stage-count'),
      stageCardsContainer: document.getElementById('stage-cards-container'),
      
      // 설정 필드
      selectOrientation: document.getElementById('select-orientation'),
      inputIcsUrl: document.getElementById('input-ics-url'),
      inputIcsFile: document.getElementById('input-ics-file'),
      btnUploadIcsFile: document.getElementById('btn-upload-ics-file'),
      btnPasteIcsText: document.getElementById('btn-paste-ics-text'),
      selectAutoSync: document.getElementById('select-auto-sync'),
      selectDecodeSpeed: document.getElementById('select-decode-speed'),
      selectSoundType: document.getElementById('select-sound-type'),
      sliderVolume: document.getElementById('slider-volume'),
      labelVolume: document.getElementById('label-volume'),
      toggleScanlines: document.getElementById('toggle-scanlines'),
      toggleVignette: document.getElementById('toggle-vignette'),

      // 커스텀 사이버 컬러 모달
      colorModal: document.getElementById('custom-color-modal'),
      colorModalTitle: document.getElementById('color-modal-title'),
      btnCloseColorModal: document.getElementById('btn-close-color-modal'),
      btnCancelColorModal: document.getElementById('btn-cancel-color-modal'),
      btnApplyColorModal: document.getElementById('btn-apply-color-modal'),
      btnOpenColorPickerFont: document.getElementById('btn-open-color-picker-font'),
      btnOpenColorPickerBg: document.getElementById('btn-open-color-picker-bg'),
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
      if (e.target.closest('#btn-open-settings') || !this.dom.modal.classList.contains('hidden')) {
        return;
      }
      this.advance();
    });

    // 2. 키보드 단축키
    window.addEventListener('keydown', (e) => {
      if (!this.dom.modal.classList.contains('hidden')) {
        if (e.key === 'Escape') this.closeModal();
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
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // 5. STAGE 동적 추가
    this.dom.btnAddStage.addEventListener('click', () => {
      this.syncCustomBufferFromDOM();
      const newStageNum = this.customStages.length + 1;
      this.customStages.push({
        stage: newStageNum,
        messages: [{ text: `새 일정 메시지`, time_info: "" }]
      });
      this.renderCustomStageCards();
      this.showToast(`단계 ${newStageNum} 추가됨`);
    });

    // 6. 볼륨 슬라이더
    this.dom.sliderVolume.addEventListener('input', (e) => {
      this.dom.labelVolume.textContent = `${e.target.value}%`;
    });

    this.dom.btnTestSound.addEventListener('click', () => {
      const vol = parseInt(this.dom.sliderVolume.value, 10);
      const soundType = this.dom.selectSoundType.value;
      if (soundType === 'synth') {
        this.playSynthBeep(vol / 100.0);
      } else {
        this.playBeep(vol);
      }
    });

    // 7. 실시간 글자/배경 색상 프리셋 원형 칩 클릭
    document.querySelectorAll('.color-circle-chip[data-color]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        const color = e.currentTarget.dataset.color;
        if (type === 'font') {
          this.config.font_color = color;
          this.applyCustomColors(color, this.config.bg_color || '#000000');
        } else if (type === 'bg') {
          this.config.bg_color = color;
          this.applyCustomColors(this.config.font_color || '#2FBFFC', color);
        }
      });
    });

    // 8. 맨 마지막 무지개 원형 칩 클릭 시 커스텀 팝업 열기
    if (this.dom.btnOpenColorPickerFont) {
      this.dom.btnOpenColorPickerFont.addEventListener('click', () => {
        this.openCustomColorModal('font');
      });
    }
    if (this.dom.btnOpenColorPickerBg) {
      this.dom.btnOpenColorPickerBg.addEventListener('click', () => {
        this.openCustomColorModal('bg');
      });
    }

    // 9. 화면 방향 변경
    this.dom.selectOrientation.addEventListener('change', (e) => {
      this.applyOrientation(e.target.value);
    });

    // 10. CRT 스캔라인 & 비네팅 토글 시 실시간 미니 프리뷰 업데이트
    if (this.dom.toggleScanlines) {
      this.dom.toggleScanlines.addEventListener('change', () => this.updateMiniCrtPreview());
    }
    if (this.dom.toggleVignette) {
      this.dom.toggleVignette.addEventListener('change', () => this.updateMiniCrtPreview());
    }

    // 11. 설정 저장 및 기본값 복원
    this.dom.btnSaveSettings.addEventListener('click', () => this.saveSettingsFromModal());
    this.dom.btnResetDefault.addEventListener('click', () => this.resetDefaults());

    // 12. 캘린더 URL 즉시 동기화
    this.dom.btnSyncNow.addEventListener('click', () => {
      const url = this.dom.inputIcsUrl.value.trim();
      this.syncCalendar(url);
    });

    // 13. ICS 파일 직접 업로드
    if (this.dom.btnUploadIcsFile && this.dom.inputIcsFile) {
      this.dom.btnUploadIcsFile.addEventListener('click', () => {
        this.dom.inputIcsFile.click();
      });
      this.dom.inputIcsFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const content = evt.target.result;
            this.importIcsText(content, `파일 (${file.name})`);
          };
          reader.readAsText(file);
        }
        e.target.value = '';
      });
    }

    // 14. ICS 텍스트 직접 붙여넣기
    if (this.dom.btnPasteIcsText) {
      this.dom.btnPasteIcsText.addEventListener('click', async () => {
        let text = '';
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            text = await navigator.clipboard.readText();
          }
        } catch (clipErr) {}

        if (!text || !text.includes('BEGIN:VCALENDAR')) {
          text = prompt("구글 캘린더나 .ics 파일의 내용을 직접 붙여넣어주세요 (BEGIN:VCALENDAR ...):", text || "");
        }

        if (text && text.trim()) {
          this.importIcsText(text, "텍스트 직접 등록");
        }
      });
    }

    // 15. 메시지 에디터 툴바
    this.dom.btnLoadSample.addEventListener('click', () => {
      this.customStages = JSON.parse(JSON.stringify(DEFAULT_MESSAGES));
      this.renderCustomStageCards();
      this.showToast("기본 예시 메시지가 로드되었습니다.");
    });

    this.dom.btnClearMessages.addEventListener('click', () => {
      this.customStages = [{ stage: 1, messages: [{ text: "새 메시지", time_info: "" }] }];
      this.renderCustomStageCards();
      this.showToast("메시지 입력란을 초기화했습니다.");
    });

    // 16. 작성된 STAGE 삐삐 적용
    this.dom.btnApplyCustom.addEventListener('click', () => this.applyCustomStages());
  }

  // ── 설정 로드 및 저장 ──
  loadConfig() {
    try {
      const stored = localStorage.getItem('limbus_beep_config');
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_CONFIG };
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
  }

  applyCustomColors(fontColor, bgColor) {
    const fc = (fontColor || this.config.font_color || '#2fbffc').toUpperCase();
    const bc = (bgColor || this.config.bg_color || '#000000').toUpperCase();

    document.documentElement.style.setProperty('--cyan-primary', fc);
    document.documentElement.style.setProperty('--bg-color', bc);
    document.documentElement.style.setProperty('--cyan-glow', `${fc}88`);
    document.body.style.backgroundColor = bc;
    if (this.dom.app) this.dom.app.style.backgroundColor = bc;

    // 모달 내 실시간 미니 프리뷰 스크린 & Hex 태그 연동
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

    // 글자 색상 원형 칩 활성화 상태 표시
    let fontPresetMatched = false;
    document.querySelectorAll('.color-circle-chip[data-type="font"][data-color]').forEach(chip => {
      const isMatch = chip.dataset.color.toUpperCase() === fc;
      chip.classList.toggle('active', isMatch);
      if (isMatch) fontPresetMatched = true;
    });
    if (this.dom.btnOpenColorPickerFont) {
      this.dom.btnOpenColorPickerFont.classList.toggle('active', !fontPresetMatched);
    }

    // 배경 색상 원형 칩 활성화 상태 표시
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

    if (miniScan) miniScan.classList.toggle('hidden', !isScanOn);
    if (miniVig) miniVig.classList.toggle('hidden', !isVigOn);
  }

  importIcsText(icsText, sourceLabel = "ICS") {
    if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
      alert("올바른 iCal/ICS 형식이 아닙니다. (BEGIN:VCALENDAR 로 시작하는 텍스트나 파일이어야 합니다.)");
      return;
    }

    try {
      const events = this.parseIcsText(icsText);
      const stages = this.distributeEventsTo3Stages(events.map(e => this.formatEvent(e)));
      this.saveStoredMessages(stages);

      if (events.length > 0) {
        this.showToast(`${sourceLabel}에서 오늘 일정 ${events.length}개를 가져왔습니다.`);
      } else {
        this.showToast(`동기화 완료: 오늘(KST) 등록된 일정이 없습니다 (0건).`);
      }
    } catch (err) {
      alert(`ICS 파싱 실패: ${err.message}`);
    }
  }

  applyOrientation(mode) {
    const targetMode = mode || this.config.orientation || 'landscape';
    // 1. Android Native Bridge 호출
    if (window.AndroidBridge && typeof window.AndroidBridge.setOrientation === 'function') {
      window.AndroidBridge.setOrientation(targetMode);
    }
    // 2. Web Screen Orientation API
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
      this.dom.crtVignette.style.display = this.config.vignette !== false;
    }
    this.applyCustomColors(this.config.font_color, this.config.bg_color);
    this.applyOrientation(this.config.orientation || 'landscape');
  }

  // ── 오디오 재생 ──
  playBeep(volumePercent = null) {
    const vol = (volumePercent !== null ? volumePercent : this.config.volume) / 100.0;
    if (vol <= 0) return;

    if (this.config.sound_type === 'synth') {
      this.playSynthBeep(vol);
      return;
    }

    try {
      this.dom.audio.volume = vol;
      this.dom.audio.currentTime = 0;
      const playPromise = this.dom.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => this.playSynthBeep(vol));
      }
    } catch {
      this.playSynthBeep(vol);
    }
  }

  playSynthBeep(vol) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(vol * 0.35, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn("오디오 재생 실패:", e);
    }
  }

  // ── 데이터 헬퍼 ──
  getCurrentStage() {
    return this.messages[this.currentStageIdx] || null;
  }

  getCurrentMessage() {
    const stage = this.getCurrentStage();
    if (!stage || !stage.messages) return null;
    return stage.messages[this.currentMsgIdx] || null;
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

    if (this.state === STATE.IDLE) {
      this.currentMsgIdx = 0;
      this.startBeeping();
    } else if (this.state === STATE.BEEPING) {
      this.startDecoding();
    } else if (this.state === STATE.DECODING) {
      this.startRevealed();
    } else if (this.state === STATE.REVEALED) {
      const stage = this.getCurrentStage();
      if (stage && this.currentMsgIdx + 1 < stage.messages.length) {
        this.currentMsgIdx++;
        this.startBeeping();
      } else {
        const isLastStage = (this.currentStageIdx + 1 >= this.messages.length);
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
      this.updateDisplayIdle();
    }
  }

  replay() {
    this.clearTimers();
    this.startBeeping();
  }

  clearTimers() {
    if (this.animInterval) clearInterval(this.animInterval);
    if (this.beepTimeout) clearTimeout(this.beepTimeout);
    this.animInterval = null;
    this.beepTimeout = null;
  }

  // ── 상태 1: BEEPING ──
  startBeeping() {
    this.state = STATE.BEEPING;
    this.playBeep();

    this.dom.progressBar.classList.remove('visible');
    this.dom.displayTime.classList.remove('visible');
    this.dom.displayMain.className = 'main-text dimmed';
    this.dom.displaySubLabel.textContent = "신호 수신 중...";

    const msg = this.getCurrentMessage();
    const cipherLen = msg ? Math.max(9, msg.text.length) : 11;
    let dotStep = 0;

    this.animInterval = setInterval(() => {
      dotStep = (dotStep + 1) % 4;
      const dots = "• ".repeat(dotStep) + "◦ ".repeat(3 - dotStep);
      this.dom.displayDots.textContent = dots;
      this.dom.displayMain.textContent = this.getRandomCipher(cipherLen);
    }, 100);

    this.beepTimeout = setTimeout(() => {
      this.startDecoding();
    }, 1100);
  }

  // ── 상태 2: DECODING ──
  startDecoding() {
    this.clearTimers();
    this.state = STATE.DECODING;

    const msg = this.getCurrentMessage();
    if (!msg) {
      this.updateDisplayIdle();
      return;
    }

    const targetText = msg.text;
    this.dom.displayDots.textContent = "• • •";
    this.dom.displaySubLabel.textContent = "▼ 데이터 복호화 진행 중... ▼";
    this.dom.progressBar.classList.add('visible');
    this.dom.displayTime.classList.remove('visible');

    let durations = { fast: 500, normal: 900, slow: 1500 };
    let totalTime = durations[this.config.decode_speed] || 900;
    let steps = 18;
    let stepTime = totalTime / steps;
    let currentStep = 0;

    this.animInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(1.0, currentStep / steps);
      this.dom.progressFill.style.width = `${progress * 100}%`;

      const revealedCount = Math.floor(targetText.length * progress);
      let frame = "";
      for (let i = 0; i < targetText.length; i++) {
        if (i < revealedCount) {
          frame += targetText[i];
        } else {
          frame += (targetText[i] === ' ') ? ' ' : CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
        }
      }
      this.dom.displayMain.textContent = frame;
      this.dom.displayMain.className = (progress > 0.6) ? 'main-text accent' : 'main-text dimmed';

      if (currentStep >= steps) {
        this.clearTimers();
        this.startRevealed();
      }
    }, stepTime);
  }

  // ── 상태 3: REVEALED ──
  startRevealed() {
    this.clearTimers();
    this.state = STATE.REVEALED;

    const msg = this.getCurrentMessage();
    if (!msg) return;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.progressBar.classList.remove('visible');
    
    this.dom.displayMain.textContent = msg.text;
    this.dom.displayMain.className = 'main-text accent';

    if (msg.time_info) {
      this.dom.displayTime.textContent = msg.time_info;
      this.dom.displayTime.classList.add('visible');
    } else {
      this.dom.displayTime.classList.remove('visible');
    }
  }

  // ── 상태 4: CLEAR ──
  startClear() {
    this.clearTimers();
    this.state = STATE.CLEAR;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');

    this.dom.displayMain.textContent = "_CLEAR._";
    this.dom.displayMain.className = 'main-text amber';
  }

  // ── 상태 5: COMPLETE ──
  startComplete() {
    this.clearTimers();
    this.state = STATE.COMPLETE;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');

    this.dom.displayMain.textContent = "_ALL_CLEAR._";
    this.dom.displayMain.className = 'main-text amber';
  }

  updateDisplayIdle() {
    this.clearTimers();
    this.state = STATE.IDLE;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.displayMain.textContent = "SPACE 를 눌러 시작";
    this.dom.displayMain.className = 'main-text';
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
  }

  updateDisplay() {
    this.updateDisplayIdle();
  }

  // ── 시계 ──
  startClock() {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      this.dom.clock.textContent = `${h}:${m}:${s} KST`;
    };
    update();
    setInterval(update, 1000);
  }

  // ── 설정 모달 열기/닫기 ──
  openModal() {
    this.dom.selectOrientation.value = this.config.orientation || 'landscape';
    this.dom.inputIcsUrl.value = this.config.ics_url || '';
    this.dom.sliderVolume.value = this.config.volume;
    this.dom.labelVolume.textContent = `${this.config.volume}%`;
    this.dom.selectAutoSync.value = String(this.config.auto_sync_min);
    this.dom.selectDecodeSpeed.value = this.config.decode_speed;
    this.dom.selectSoundType.value = this.config.sound_type || 'file';
    this.dom.toggleScanlines.checked = this.config.scanlines;
    this.dom.toggleVignette.checked = this.config.vignette !== false;
    this.applyCustomColors(this.config.font_color, this.config.bg_color);

    // 사용자가 추가/편집한 STAGE 목록 복원 및 렌더링
    this.customStages = JSON.parse(JSON.stringify(this.messages));
    this.renderCustomStageCards();

    this.dom.modal.classList.remove('hidden');
  }

  closeModal() {
    this.applySettings();
    this.dom.modal.classList.add('hidden');
  }

  // ── 동적 STAGE 카드 렌더링 (각 메시지가 개별 카드로 분리됨) ──
  renderCustomStageCards() {
    this.dom.stageCardsContainer.innerHTML = '';
    this.dom.labelCustomStageCount.textContent = `${this.customStages.length} STAGES`;

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

      // STAGE 삭제 버튼
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

      // 메시지 추가 버튼
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

      // 개별 메시지 삭제 버튼
      stageCard.querySelectorAll('.btn-del-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.syncCustomBufferFromDOM();
          const targetSIdx = parseInt(e.target.dataset.sidx, 10);
          const targetMIdx = parseInt(e.target.dataset.midx, 10);
          this.customStages[targetSIdx].messages.splice(targetMIdx, 1);
          this.renderCustomStageCards();
        });
      });

      this.dom.stageCardsContainer.appendChild(stageCard);
    });
  }

  syncCustomBufferFromDOM() {
    this.customStages.forEach((stage, sIdx) => {
      stage.stage = sIdx + 1;
      const msgItems = document.querySelectorAll(`.msg-card-item[data-sidx="${sIdx}"]`);
      if (msgItems && msgItems.length > 0) {
        const parsedMessages = [];
        msgItems.forEach(item => {
          const timeInput = item.querySelector('.msg-time-input');
          const textInput = item.querySelector('.msg-text-input');
          const time_info = timeInput ? timeInput.value.trim() : "";
          const text = textInput ? textInput.value.trim() : "";
          if (text || time_info) {
            parsedMessages.push({ text: text || "(빈 메시지)", time_info });
          }
        });
        stage.messages = parsedMessages;
      }
    });
  }

  applyCustomStages() {
    this.syncCustomBufferFromDOM();
    const validStages = this.customStages.filter(s => s.messages && s.messages.length > 0);

    if (!validStages.length) {
      alert("최소 1개 이상의 메시지를 작성해야 합니다.");
      return;
    }

    this.saveStoredMessages(validStages);
    this.showToast(`${validStages.length}개 단계 메시지가 시뮬레이터에 적용되었습니다.`);
    this.closeModal();
  }

  saveSettingsFromModal() {
    this.syncCustomBufferFromDOM();
    const validStages = this.customStages.filter(s => s.messages && s.messages.length > 0);
    if (validStages.length > 0) {
      this.saveStoredMessages(validStages);
    }

    const newConfig = {
      orientation: this.dom.selectOrientation.value || 'landscape',
      ics_url: this.dom.inputIcsUrl.value.trim(),
      volume: parseInt(this.dom.sliderVolume.value, 10),
      auto_sync_min: parseInt(this.dom.selectAutoSync.value, 10),
      decode_speed: this.dom.selectDecodeSpeed.value,
      sound_type: this.dom.selectSoundType.value,
      font_color: this.dom.pickerFontColor ? this.dom.pickerFontColor.value : '#2fbffc',
      bg_color: this.dom.pickerBgColor ? this.dom.pickerBgColor.value : '#000000',
      scanlines: this.dom.toggleScanlines.checked,
      vignette: this.dom.toggleVignette.checked,
    };
    this.saveConfig(newConfig);
    this.showToast("환경 설정이 저장되었습니다.");
    this.closeModal();
  }

  resetDefaults() {
    if (confirm("모든 설정을 기본값으로 초기화하시겠습니까?")) {
      this.saveConfig(DEFAULT_CONFIG);
      this.saveStoredMessages(DEFAULT_MESSAGES);
      this.openModal();
      this.showToast("기본값으로 복원되었습니다.");
    }
  }

  // ── Google Calendar ICS 파싱 & 동기화 ──
  async fetchIcsContent(rawUrl) {
    let cleanUrl = rawUrl.trim();
    // webcal:// 프로토콜 변환
    if (cleanUrl.startsWith("webcal://")) {
      cleanUrl = "https://" + cleanUrl.substring(9);
    }

    // 1. Android Native Bridge: 안드로이드 네이티브 HTTP 연결로 직접 다운로드 (CORS 0% 제한 없음)
    if (window.AndroidBridge && typeof window.AndroidBridge.fetchIcsDirect === 'function') {
      try {
        const result = window.AndroidBridge.fetchIcsDirect(cleanUrl);
        if (result && !result.startsWith("ERROR:") && result.includes("BEGIN:VCALENDAR")) {
          return result;
        } else if (result && result.startsWith("ERROR: HTTP 404")) {
          throw new Error("404 오류: 캘린더 주소가 존재하지 않습니다. Google 캘린더 설정에서 '비공개 주소(iCal)'를 다시 확인해주세요.");
        } else if (result && result.startsWith("ERROR: HTTP 403")) {
          throw new Error("403 오류: 접근 권한이 없습니다. '비공개 주소(iCal)'가 올바른지 확인해주세요.");
        }
      } catch (err) {
        if (err.message && (err.message.includes("404") || err.message.includes("403"))) throw err;
        console.warn("AndroidBridge fetch failed, trying web fallbacks...", err);
      }
    }

    // 2. 브라우저 Direct fetch 시도
    try {
      const resp = await fetch(cleanUrl, { cache: 'no-cache' });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes("BEGIN:VCALENDAR")) return text;
      }
    } catch (e) {}

    // 3. 다중 고신뢰도 CORS 프록시 풀 순차 시도 (JSONP/JSON 파싱 지원)
    // 3-1. allorigins JSON API (가장 안정적)
    try {
      const jsonpUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
      const resp = await fetch(jsonpUrl, { cache: 'no-cache' });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.contents && data.contents.includes("BEGIN:VCALENDAR")) {
          return data.contents;
        }
      }
    } catch (e) {}

    // 3-2. codetabs proxy
    try {
      const resp = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, { cache: 'no-cache' });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes("BEGIN:VCALENDAR")) return text;
      }
    } catch (e) {}

    // 3-3. corsproxy.io
    try {
      const resp = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(cleanUrl)}`, { cache: 'no-cache' });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes("BEGIN:VCALENDAR")) return text;
      }
    } catch (e) {}

    // 3-4. allorigins raw
    try {
      const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`, { cache: 'no-cache' });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes("BEGIN:VCALENDAR")) return text;
      }
    } catch (e) {}

    throw new Error("캘린더 주소(iCal)를 불러오지 못했습니다.\n\n확인 사항:\n1. Google 캘린더 설정 ➔ [캘린더 통합] ➔ [iCal 형식의 비공개 주소]를 복사했는지 확인\n2. 주소가 https://calendar.google.com/calendar/ical/.../basic.ics 형태인지 확인\n3. 브라우저/기기의 인터넷 연결 확인");
  }

  async syncCalendar(url, isSilent = false) {
    if (!url || url.trim().length < 10) {
      if (!isSilent) alert("유효한 Google Calendar 비공개 iCal 주소를 입력해주세요.");
      return;
    }

    const cleanUrl = url.trim().replace(/^webcal:\/\//, 'https://');
    if (!cleanUrl.includes("calendar.google.com") && !cleanUrl.endsWith(".ics")) {
      if (!isSilent) {
        const proceed = confirm("입력된 주소가 일반적인 Google 캘린더 iCal 주소(.ics)와 다릅니다. 계속 진행하시겠습니까?");
        if (!proceed) return;
      }
    }

    if (!isSilent && this.dom.btnSyncNow) {
      this.dom.btnSyncNow.textContent = "동기화 중...";
      this.dom.btnSyncNow.disabled = true;
    }

    try {
      const icsText = await this.fetchIcsContent(cleanUrl);

      if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
        throw new Error("올바른 iCal/ICS 파일 형식이 아닙니다.");
      }

      const events = this.parseIcsText(icsText);
      const stages = this.distributeEventsTo3Stages(events.map(e => this.formatEvent(e)));

      this.saveStoredMessages(stages);
      this.config.ics_url = cleanUrl;
      this.saveConfig(this.config);

      if (!isSilent) {
        if (events.length > 0) {
          this.showToast(`오늘 일정 ${events.length}개를 성공적으로 가져왔습니다.`);
        } else {
          this.showToast("동기화 완료: 오늘(KST) 등록된 일정이 없습니다 (0건).");
        }
        if (this.dom.btnSyncNow) {
          this.dom.btnSyncNow.textContent = "동기화";
          this.dom.btnSyncNow.disabled = false;
        }
      }
    } catch (e) {
      console.error("캘린더 동기화 실패:", e);
      if (!isSilent) {
        alert(`캘린더 동기화 실패:\n${e.message}`);
        if (this.dom.btnSyncNow) {
          this.dom.btnSyncNow.textContent = "동기화";
          this.dom.btnSyncNow.disabled = false;
        }
      }
    }
  }

  // ── 한국 표준시(KST, UTC+9) 기준 오늘(00:00:00 ~ 23:59:59.999) 범위 계산 ──
  getKstTodayRange() {
    const now = new Date();
    // 브라우저 타임존 환경과 무관하게 Asia/Seoul 기준 날짜/시간 컴포넌트 추출
    const kstFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short'
    });
    const parts = kstFormatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type)?.value;
    
    const y = parseInt(getPart('year'), 10);
    const m = parseInt(getPart('month'), 10) - 1; // 0-indexed
    const d = parseInt(getPart('day'), 10);

    // KST 00:00:00 ~ 23:59:59의 UTC 에포크 ms (KST = UTC+9)
    const kstStartEpoch = Date.UTC(y, m, d, 0, 0, 0, 0) - (9 * 3600 * 1000);
    const kstEndEpoch = Date.UTC(y, m, d, 23, 59, 59, 999) - (9 * 3600 * 1000);

    const weekdayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const dayOfWeek = weekdayMap[getPart('weekday')] ?? new Date(kstStartEpoch + 9 * 3600 * 1000).getUTCDay();

    return {
      year: y,
      month: m,
      day: d,
      startEpoch: kstStartEpoch,
      endEpoch: kstEndEpoch,
      dayOfWeek: dayOfWeek, // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
      dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    };
  }

  // ── iCal 날짜 문자열을 KST 기준 시간 객체로 정밀 파싱 ──
  parseIcsDate(val) {
    if (!val) return null;
    val = val.trim();
    const isUtc = val.endsWith('Z');
    const clean = val.replace('Z', '');

    if (clean.length === 8) {
      // 종일 일정 (YYYYMMDD)
      const y = parseInt(clean.substring(0, 4), 10);
      const m = parseInt(clean.substring(4, 6), 10) - 1;
      const d = parseInt(clean.substring(6, 8), 10);
      const startEpoch = Date.UTC(y, m, d, 0, 0, 0, 0) - (9 * 3600 * 1000);
      const endEpoch = Date.UTC(y, m, d, 23, 59, 59, 999) - (9 * 3600 * 1000);
      return {
        year: y,
        month: m,
        day: d,
        epoch: startEpoch,
        endEpoch: endEpoch,
        isAllDay: true,
        hours: 0,
        minutes: 0
      };
    }

    if (clean.includes('T')) {
      const [dPart, tPart] = clean.split('T');
      const y = parseInt(dPart.substring(0, 4), 10);
      const m = parseInt(dPart.substring(4, 6), 10) - 1;
      const d = parseInt(dPart.substring(6, 8), 10);
      const hh = parseInt(tPart.substring(0, 2), 10) || 0;
      const mm = parseInt(tPart.substring(2, 4), 10) || 0;
      const ss = parseInt(tPart.substring(4, 6), 10) || 0;

      let epoch = 0;
      let kstH = hh;
      let kstM = mm;

      if (isUtc) {
        // UTC 시간인 경우 KST(+9시간)로 정확히 변환
        epoch = Date.UTC(y, m, d, hh, mm, ss);
        const kstDate = new Date(epoch + 9 * 3600 * 1000);
        kstH = kstDate.getUTCHours();
        kstM = kstDate.getUTCMinutes();
      } else {
        // 로컬/TZID 시간인 경우 기본적으로 한국 시간(KST)으로 해석
        epoch = Date.UTC(y, m, d, hh, mm, ss) - (9 * 3600 * 1000);
      }

      return {
        year: y,
        month: m,
        day: d,
        epoch: epoch,
        isAllDay: false,
        hours: kstH,
        minutes: kstM
      };
    }
    return null;
  }

  parseIcsText(icsText) {
    // 1. RFC 5545 라인 언폴딩 (줄바꿈 후 공백/탭 연속 처리)
    const cleanIcs = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r[ \t]/g, '');
    const lines = cleanIcs.split(/\r\n|\n|\r/);

    const kstToday = this.getKstTodayRange();
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    const rawEvents = [];
    let inEvent = false;
    let cur = {};

    for (let line of lines) {
      line = line.trim();
      if (line === "BEGIN:VEVENT") {
        inEvent = true;
        cur = {};
      } else if (line === "END:VEVENT") {
        inEvent = false;
        if (cur.SUMMARY || cur.DTSTART) {
          rawEvents.push(cur);
        }
      } else if (inEvent && line.includes(":")) {
        const idx = line.indexOf(":");
        const rawKey = line.substring(0, idx);
        const val = line.substring(idx + 1);
        const key = rawKey.split(";")[0].toUpperCase();
        cur[key] = val;
      }
    }

    const todayEvents = [];

    rawEvents.forEach(ev => {
      const dtstartStr = ev.DTSTART || "";
      if (!dtstartStr) return;
      const startParsed = this.parseIcsDate(dtstartStr);
      if (!startParsed) return;

      const dtendStr = ev.DTEND || "";
      let endParsed = dtendStr ? this.parseIcsDate(dtendStr) : null;
      if (!endParsed) {
        const durMs = startParsed.isAllDay ? 24 * 3600 * 1000 : 3600 * 1000;
        endParsed = {
          epoch: startParsed.epoch + durMs,
          isAllDay: startParsed.isAllDay,
          hours: (startParsed.hours + (startParsed.isAllDay ? 0 : 1)) % 24,
          minutes: startParsed.minutes
        };
      }

      // 종일 일정의 종료일 보정: iCal DTEND(종일)는 exclusive(종료 익일 00:00)이므로 endEpoch 사용
      const eventStartEpoch = startParsed.epoch;
      const eventEndEpoch = startParsed.isAllDay ? (startParsed.endEpoch || (endParsed.epoch - 1000)) : endParsed.epoch;

      const summary = (ev.SUMMARY || "(제목 없음)").replace(/\\([,;Nn\\])/g, (m, c) => (c === 'n' || c === 'N') ? ' ' : c);

      // ── 1. 반복 일정(RRULE)인 경우 오늘(KST) 발생 여부 체크 ──
      if (ev.RRULE) {
        const rrule = ev.RRULE;
        const freqMatch = rrule.match(/FREQ=([^;]+)/);
        const freq = freqMatch ? freqMatch[1].toUpperCase() : '';
        const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
        const byDays = byDayMatch ? byDayMatch[1].toUpperCase().split(',') : [];
        const untilMatch = rrule.match(/UNTIL=([^;]+)/);
        const untilParsed = untilMatch ? this.parseIcsDate(untilMatch[1]) : null;

        // 시작일이 오늘 이후이면 아직 시작하지 않은 반복 일정
        if (startParsed.epoch > kstToday.endEpoch) return;
        // 종료일(UNTIL)이 오늘 이전이면 이미 종료된 반복 일정
        if (untilParsed && untilParsed.epoch < kstToday.startEpoch) return;

        let occursToday = false;
        const todayDayName = dayNames[kstToday.dayOfWeek];

        if (freq === 'DAILY') {
          occursToday = true;
        } else if (freq === 'WEEKLY') {
          if (byDays.length > 0) {
            occursToday = byDays.some(bd => bd.endsWith(todayDayName));
          } else {
            const startKstDate = new Date(startParsed.epoch + 9 * 3600 * 1000);
            occursToday = (startKstDate.getUTCDay() === kstToday.dayOfWeek);
          }
        } else if (freq === 'MONTHLY') {
          occursToday = (startParsed.day === kstToday.day);
        } else if (freq === 'YEARLY') {
          occursToday = (startParsed.month === kstToday.month && startParsed.day === kstToday.day);
        }

        if (occursToday) {
          todayEvents.push({
            summary,
            isAllDay: startParsed.isAllDay,
            startHours: startParsed.hours,
            startMinutes: startParsed.minutes,
            endHours: endParsed.hours,
            endMinutes: endParsed.minutes,
            sortEpoch: Date.UTC(kstToday.year, kstToday.month, kstToday.day, startParsed.hours, startParsed.minutes, 0)
          });
        }
      } else {
        // ── 2. 단일 / 다기간 일정: 오늘(한국시간 00시 ~ 24시)과 겹치는지 체크 ──
        const overlapsToday = (eventStartEpoch <= kstToday.endEpoch && eventEndEpoch >= kstToday.startEpoch);
        if (overlapsToday) {
          todayEvents.push({
            summary,
            isAllDay: startParsed.isAllDay,
            startHours: startParsed.hours,
            startMinutes: startParsed.minutes,
            endHours: endParsed.hours,
            endMinutes: endParsed.minutes,
            sortEpoch: eventStartEpoch
          });
        }
      }
    });

    // 오늘 일정 시간순 정렬
    todayEvents.sort((a, b) => a.sortEpoch - b.sortEpoch);

    // 중복 제거
    const unique = [];
    const seen = new Set();
    todayEvents.forEach(e => {
      const key = `${e.summary}_${e.startHours}:${e.startMinutes}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(e);
      }
    });

    return unique;
  }

  formatEvent(ev) {
    let timeInfo = "종일";
    if (!ev.isAllDay) {
      const sh = String(ev.startHours).padStart(2, '0');
      const sm = String(ev.startMinutes).padStart(2, '0');
      const eh = String(ev.endHours).padStart(2, '0');
      const em = String(ev.endMinutes).padStart(2, '0');
      timeInfo = `${sh}:${sm} - ${eh}:${em}`;
    }
    return { text: ev.summary, time_info: timeInfo };
  }

  distributeEventsTo3Stages(formattedEvents) {
    if (!formattedEvents || formattedEvents.length === 0) {
      return [{ stage: 1, messages: [{ text: "오늘 등록된 일정이 없습니다.", time_info: "오늘" }] }];
    }

    const n = 3;
    const stages = [];
    const total = formattedEvents.length;

    if (total <= 3) {
      // 1~3개인 경우 각 STAGE에 1개씩 깔끔하게 분배
      for (let s = 0; s < total; s++) {
        stages.push({
          stage: s + 1,
          messages: [formattedEvents[s]]
        });
      }
    } else {
      // 4개 이상인 경우 균등 분배
      const base = Math.floor(total / n);
      const extra = total % n;
      let idx = 0;

      for (let s = 0; s < n; s++) {
        const count = base + (s < extra ? 1 : 0);
        if (count === 0) continue;
        stages.push({
          stage: s + 1,
          messages: formattedEvents.slice(idx, idx + count)
        });
        idx += count;
      }
    }

    return stages;
  }

  // ── 프리미엄 사이버 컬러 피커 시스템 ──
  initCustomColorPicker() {
    this.colorPickerTarget = 'font';
    this.currentColorH = 198;
    this.currentColorS = 81;
    this.currentColorV = 99;
    this.currentColorHex = '#2FBFFC';

    // 1. 2D 채도/명도 캔버스 인터랙션
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
      this.dom.pickerSvBox.addEventListener('pointerdown', (e) => {
        isDraggingSV = true;
        this.dom.pickerSvBox.setPointerCapture(e.pointerId);
        handleSVMove(e);
      });
      this.dom.pickerSvBox.addEventListener('pointermove', (e) => {
        if (isDraggingSV) handleSVMove(e);
      });
      this.dom.pickerSvBox.addEventListener('pointerup', (e) => {
        if (isDraggingSV) {
          isDraggingSV = false;
          try { this.dom.pickerSvBox.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      });
      this.dom.pickerSvBox.addEventListener('pointercancel', () => {
        isDraggingSV = false;
      });
    }

    // 2. 1D HUE 바 인터랙션
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
      this.dom.pickerHueTrack.addEventListener('pointerdown', (e) => {
        isDraggingHue = true;
        this.dom.pickerHueTrack.setPointerCapture(e.pointerId);
        handleHueMove(e);
      });
      this.dom.pickerHueTrack.addEventListener('pointermove', (e) => {
        if (isDraggingHue) handleHueMove(e);
      });
      this.dom.pickerHueTrack.addEventListener('pointerup', (e) => {
        if (isDraggingHue) {
          isDraggingHue = false;
          try { this.dom.pickerHueTrack.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      });
      this.dom.pickerHueTrack.addEventListener('pointercancel', () => {
        isDraggingHue = false;
      });
    }

    // 3. HEX 텍스트 인풋
    if (this.dom.pickerHexInput) {
      this.dom.pickerHexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.updateColorFromHex(val);
        }
      });
    }

    // 4. RGB 숫자 인풋
    const handleRgbChange = () => {
      const r = parseInt(this.dom.pickerRInput.value, 10) || 0;
      const g = parseInt(this.dom.pickerGInput.value, 10) || 0;
      const b = parseInt(this.dom.pickerBInput.value, 10) || 0;
      this.updateColorFromRgb(r, g, b);
    };

    if (this.dom.pickerRInput) this.dom.pickerRInput.addEventListener('input', handleRgbChange);
    if (this.dom.pickerGInput) this.dom.pickerGInput.addEventListener('input', handleRgbChange);
    if (this.dom.pickerBInput) this.dom.pickerBInput.addEventListener('input', handleRgbChange);

    // 5. 모달 버튼 액션
    if (this.dom.btnCloseColorModal) {
      this.dom.btnCloseColorModal.addEventListener('click', () => this.closeCustomColorModal());
    }
    if (this.dom.btnCancelColorModal) {
      this.dom.btnCancelColorModal.addEventListener('click', () => this.closeCustomColorModal());
    }
    if (this.dom.btnApplyColorModal) {
      this.dom.btnApplyColorModal.addEventListener('click', () => this.applyChosenCustomColor());
    }
    if (this.dom.colorModal) {
      this.dom.colorModal.addEventListener('click', (e) => {
        if (e.target === this.dom.colorModal) this.closeCustomColorModal();
      });
    }
  }

  openCustomColorModal(target = 'font') {
    this.colorPickerTarget = target;
    if (this.dom.colorModalTitle) {
      this.dom.colorModalTitle.textContent = target === 'font' ? '🎨 글자 색상 사용자 지정' : '🎨 배경 색상 사용자 지정';
    }

    const currentHex = target === 'font' ? (this.config.font_color || '#2FBFFC') : (this.config.bg_color || '#000000');
    this.updateColorFromHex(currentHex);
    this.renderQuickPresets();

    if (this.dom.colorModal) this.dom.colorModal.classList.remove('hidden');
  }

  closeCustomColorModal() {
    if (this.dom.colorModal) this.dom.colorModal.classList.add('hidden');
  }

  updateColorFromHSV(h, s, v) {
    this.currentColorH = Math.max(0, Math.min(360, h));
    this.currentColorS = Math.max(0, Math.min(100, s));
    this.currentColorV = Math.max(0, Math.min(100, v));

    const rgb = this.hsvToRgb(this.currentColorH, this.currentColorS, this.currentColorV);
    const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
    this.currentColorHex = hex;

    // 1. SV 박스 틴트 & 커서 위치
    if (this.dom.pickerSvBox) {
      this.dom.pickerSvBox.style.backgroundColor = `hsl(${this.currentColorH}, 100%, 50%)`;
    }
    if (this.dom.pickerSvCursor) {
      this.dom.pickerSvCursor.style.left = `${this.currentColorS}%`;
      this.dom.pickerSvCursor.style.top = `${100 - this.currentColorV}%`;
    }

    // 2. Hue 썸 위치
    if (this.dom.pickerHueThumb) {
      this.dom.pickerHueThumb.style.left = `${(this.currentColorH / 360) * 100}%`;
    }

    // 3. 라이브 스와치 & 발광
    if (this.dom.pickerLiveSwatch) {
      this.dom.pickerLiveSwatch.style.backgroundColor = hex;
      this.dom.pickerLiveSwatch.style.borderColor = hex;
      this.dom.pickerLiveSwatch.style.boxShadow = `0 0 14px ${hex}99`;
    }

    // 4. 인풋 필드 동기화 (포커스 중이 아닐 때만)
    if (this.dom.pickerHexInput && document.activeElement !== this.dom.pickerHexInput) {
      this.dom.pickerHexInput.value = hex;
    }
    if (this.dom.pickerRInput && document.activeElement !== this.dom.pickerRInput) this.dom.pickerRInput.value = rgb.r;
    if (this.dom.pickerGInput && document.activeElement !== this.dom.pickerGInput) this.dom.pickerGInput.value = rgb.g;
    if (this.dom.pickerBInput && document.activeElement !== this.dom.pickerBInput) this.dom.pickerBInput.value = rgb.b;

    // 5. 퀵 프리셋 칩 활성화 표시
    document.querySelectorAll('.quick-preset-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.color.toUpperCase() === hex);
    });
  }

  updateColorFromHex(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return;
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.updateColorFromHSV(hsv.h, hsv.s, hsv.v);
  }

  updateColorFromRgb(r, g, b) {
    const hsv = this.rgbToHsv(r, g, b);
    this.updateColorFromHSV(hsv.h, hsv.s, hsv.v);
  }

  renderQuickPresets() {
    if (!this.dom.quickPresetGrid) return;
    this.dom.quickPresetGrid.innerHTML = '';

    const presets = [
      "#2FBFFC", "#00E5FF", "#38C5FF", "#5CD0FF",
      "#00E676", "#69F0AE", "#B2FF59", "#76FF03",
      "#FF9D00", "#FFC107", "#FFD600", "#FFAB00",
      "#FF5252", "#FF1744", "#F50057", "#D500F9",
      "#7C4DFF", "#651FFF", "#3D5AFE", "#2979FF",
      "#FFFFFF", "#B0BEC5", "#050E18", "#000000"
    ];

    presets.forEach(color => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quick-preset-chip';
      chip.dataset.color = color;
      chip.style.backgroundColor = color;
      chip.style.color = color;
      chip.title = color;
      if (color.toUpperCase() === this.currentColorHex) {
        chip.classList.add('active');
      }
      chip.addEventListener('click', () => {
        this.updateColorFromHex(color);
      });
      this.dom.quickPresetGrid.appendChild(chip);
    });
  }

  applyChosenCustomColor() {
    const chosen = this.currentColorHex;
    if (this.colorPickerTarget === 'font') {
      this.config.font_color = chosen;
      this.applyCustomColors(chosen, this.config.bg_color || '#000000');
    } else {
      this.config.bg_color = chosen;
      this.applyCustomColors(this.config.font_color || '#2FBFFC', chosen);
    }
    this.closeCustomColorModal();
    this.showToast(`색상이 적용되었습니다: ${chosen}`);
  }

  // ── 색상 변환 헬퍼 함수 ──
  hsvToRgb(h, s, v) {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
  }

  rgbToHex(r, g, b) {
    const toHex = (n) => {
      const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
  }

  hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return null;
    const num = parseInt(c, 16);
    if (isNaN(num)) return null;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  // ── 토스트 알림 ──
  showToast(msg) {
    this.dom.toast.textContent = msg;
    this.dom.toast.classList.remove('hidden');
    setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, 2800);
  }
}

// 앱 실행
document.addEventListener('DOMContentLoaded', () => {
  window.pagerApp = new PagerApp();
});
