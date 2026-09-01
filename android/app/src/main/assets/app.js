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
  theme_color: 'cyan',      // cyan | amber | green
  scanlines: true,
  vignette: true,
  google_client_id: '',
  google_token: '',
  google_email: '',
};

const DEFAULT_MESSAGES = [
  {
    stage: 1,
    messages: [
      { text: "관리자님, 오늘의 일정을 확인하십시오.", time_info: "09:00 - 10:00" },
      { text: "설정에서 구글 캘린더를 연동할 수 있습니다.", time_info: "11:00 - 12:00" }
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
      { text: "오늘 하루도 수고하셨습니다. _CLEAR._", time_info: "20:00 - 21:00" }
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
    this.bindEvents();
    this.applySettings();
    this.initGoogleOAuth();
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
      btnPasteClipboard: document.getElementById('btn-paste-clipboard'),
      btnTestSound: document.getElementById('btn-test-sound'),
      
      // Google 로그인 관련
      inputGoogleClientId: document.getElementById('input-google-client-id'),
      btnGoogleLogin: document.getElementById('btn-google-login'),
      btnGoogleLogout: document.getElementById('btn-google-logout'),
      googleLoginText: document.getElementById('google-login-text'),
      oauthAccountInfo: document.getElementById('oauth-account-info'),
      oauthAccountEmail: document.getElementById('oauth-account-email'),
      
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
      selectAutoSync: document.getElementById('select-auto-sync'),
      selectDecodeSpeed: document.getElementById('select-decode-speed'),
      selectSoundType: document.getElementById('select-sound-type'),
      selectThemeColor: document.getElementById('select-theme-color'),
      sliderVolume: document.getElementById('slider-volume'),
      labelVolume: document.getElementById('label-volume'),
      toggleScanlines: document.getElementById('toggle-scanlines'),
      toggleVignette: document.getElementById('toggle-vignette'),
      
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

    // 4. 클립보드 붙여넣기 버튼
    if (this.dom.btnPasteClipboard) {
      this.dom.btnPasteClipboard.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            this.dom.inputIcsUrl.value = text.trim();
            this.showToast("클립보드 내용을 붙여넣었습니다.");
          }
        } catch (err) {
          this.showToast("클립보드 권한이 필요합니다. 직접 붙여넣으세요.");
        }
      });
    }

    // 5. 모달 탭 전환
    this.dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.tabBtns.forEach(b => b.classList.remove('active'));
        this.dom.tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // 6. STAGE 동적 추가
    this.dom.btnAddStage.addEventListener('click', () => {
      this.syncCustomBufferFromDOM();
      const newStageNum = this.customStages.length + 1;
      this.customStages.push({
        stage: newStageNum,
        messages: [{ text: `새 일정 메시지 ${newStageNum}`, time_info: "" }]
      });
      this.renderCustomStageCards();
      this.showToast(`STAGE ${newStageNum} 추가됨`);
    });

    // 7. 볼륨 슬라이더
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

    // 8. 실시간 테마 컬러 미리보기
    this.dom.selectThemeColor.addEventListener('change', (e) => {
      this.applyThemeClass(e.target.value);
    });

    // 9. 화면 방향 변경
    this.dom.selectOrientation.addEventListener('change', (e) => {
      this.applyOrientation(e.target.value);
    });

    // 10. Google 로그인 & 로그아웃
    this.dom.btnGoogleLogin.addEventListener('click', () => this.handleGoogleSignIn());
    this.dom.btnGoogleLogout.addEventListener('click', () => this.handleGoogleSignOut());

    // 11. 설정 저장 및 기본값 복원
    this.dom.btnSaveSettings.addEventListener('click', () => this.saveSettingsFromModal());
    this.dom.btnResetDefault.addEventListener('click', () => this.resetDefaults());

    // 12. 캘린더 즉시 동기화
    this.dom.btnSyncNow.addEventListener('click', () => {
      const url = this.dom.inputIcsUrl.value.trim();
      this.syncCalendar(url);
    });

    // 13. 메시지 에디터 툴바
    this.dom.btnLoadSample.addEventListener('click', () => {
      this.customStages = JSON.parse(JSON.stringify(DEFAULT_MESSAGES));
      this.renderCustomStageCards();
      this.showToast("기본 3단계 예시가 로드되었습니다.");
    });

    this.dom.btnClearMessages.addEventListener('click', () => {
      this.customStages = [{ stage: 1, messages: [] }];
      this.renderCustomStageCards();
      this.showToast("메시지 입력란을 모두 비웠습니다.");
    });

    // 14. 작성된 STAGE 삐삐 적용
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

  applyThemeClass(themeName) {
    document.body.className = '';
    if (themeName === 'amber') document.body.classList.add('theme-amber');
    else if (themeName === 'green') document.body.classList.add('theme-green');
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
      this.dom.crtVignette.style.display = this.config.vignette ? 'block' : 'none';
    }
    this.applyThemeClass(this.config.theme_color || 'cyan');
    this.applyOrientation(this.config.orientation || 'landscape');
  }

  // ── Google OAuth 간편 로그인 연동 ──
  initGoogleOAuth() {
    this.updateGoogleUI();
  }

  updateGoogleUI() {
    if (this.config.google_token) {
      this.dom.googleLoginText.textContent = "Google 캘린더 즉시 재동기화";
      this.dom.oauthAccountInfo.classList.remove('hidden');
      this.dom.oauthAccountEmail.textContent = this.config.google_email ? `${this.config.google_email} 연동됨` : "Google 계정 연동 완료";
      this.dom.btnGoogleLogout.classList.remove('hidden');
    } else {
      this.dom.googleLoginText.textContent = "Google 계정으로 로그인하여 동기화";
      this.dom.oauthAccountInfo.classList.add('hidden');
      this.dom.btnGoogleLogout.classList.add('hidden');
    }
  }

  async handleGoogleSignIn() {
    if (this.config.google_token) {
      await this.fetchGoogleCalendarApi(this.config.google_token);
      return;
    }

    const clientId = this.config.google_client_id || "62267119906-vmtpf5lna011f2jo8a6djamllb13c7io.apps.googleusercontent.com";

    // 1. Google Identity Services (GIS) Token Client 시도 (구글 공식 권장)
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
          callback: async (resp) => {
            if (resp && resp.access_token) {
              await this.onOAuthTokenReceived(resp.access_token);
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      } catch (gisErr) {
        console.warn("GIS initTokenClient fallback to popup:", gisErr);
      }
    }

    // 2. Standalone Popup Flow Fallback (모바일 웹뷰 / 브라우저 팝업)
    try {
      const redirectUri = window.location.origin && !window.location.origin.startsWith('file:') 
        ? `${window.location.origin}${window.location.pathname}` 
        : 'http://localhost:8765/index.html';
      const scope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email';

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;

      const width = 500;
      const height = 620;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(authUrl, 'google_login_popup', `width=${width},height=${height},top=${top},left=${left}`);

      this.showToast("구글 계정 로그인 창이 열립니다.");

      const pollTimer = setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            clearInterval(pollTimer);
            return;
          }
          if (popup.location.href && popup.location.href.includes("access_token=")) {
            const hash = popup.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get("access_token");
            if (token) {
              popup.close();
              clearInterval(pollTimer);
              await this.onOAuthTokenReceived(token);
            }
          }
        } catch (e) {}
      }, 500);

    } catch (err) {
      console.warn(err);
      this.showToast("팝업이 차단되었는지 확인하세요.");
    }
  }

  async onOAuthTokenReceived(token) {
    if (!token) return;
    this.config.google_token = token;
    
    try {
      const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (userResp.ok) {
        const userData = await userResp.json();
        this.config.google_email = userData.email || '';
      }
    } catch (e) {}

    this.saveConfig(this.config);
    this.updateGoogleUI();
    this.showToast("Google 계정 로그인 성공!");
    await this.fetchGoogleCalendarApi(token);
  }

  handleGoogleSignOut() {
    this.config.google_token = '';
    this.config.google_email = '';
    this.saveConfig(this.config);
    this.updateGoogleUI();
    this.showToast("Google 계정 연결이 해제되었습니다.");
  }

  async fetchGoogleCalendarApi(token) {
    this.showToast("Google 캘린더에서 오늘의 일정을 가져오는 중...");
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true&orderBy=startTime`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          this.config.google_token = '';
          this.saveConfig(this.config);
          this.updateGoogleUI();
          throw new Error("로그인 토큰이 만료되었습니다. 다시 로그인해주세요.");
        }
        throw new Error(`API 응답 오류: ${resp.statusText}`);
      }

      const data = await resp.json();
      const items = data.items || [];
      const events = items.map(item => {
        const summary = item.summary || "(제목 없음)";
        let timeInfo = "종일";
        if (item.start && item.start.dateTime) {
          const s = new Date(item.start.dateTime);
          const e = item.end && item.end.dateTime ? new Date(item.end.dateTime) : null;
          const sStr = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
          if (e) {
            const eStr = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
            timeInfo = `${sStr} - ${eStr}`;
          } else {
            timeInfo = sStr;
          }
        }
        return { text: summary, time_info: timeInfo };
      });

      const stages = this.distributeEventsTo3Stages(events);
      this.saveStoredMessages(stages);
      this.showToast(`오늘 일정 ${events.length}개를 가져와 [메시지 & STAGE]에 채웠습니다.`);
    } catch (err) {
      console.error(err);
      alert(`Google Calendar 동기화 실패: ${err.message}`);
    }
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
        this.startClear();
      }
    } else if (this.state === STATE.CLEAR) {
      this.currentStageIdx++;
      this.currentMsgIdx = 0;
      if (this.currentStageIdx >= this.messages.length) {
        this.startComplete();
      } else {
        this.startBeeping();
      }
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
    this.dom.displaySubLabel.textContent = "신호 수신 중 (RECEIVING)...";

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

    this.dom.displayDots.textContent = "━━ ALL CLEAR ━━";
    this.dom.displaySubLabel.textContent = "모든 메시지 수신 완료";
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');

    this.dom.displayMain.textContent = "수감자 배정 일정 완료";
    this.dom.displayMain.className = 'main-text accent';
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
    if (this.dom.inputGoogleClientId) {
      this.dom.inputGoogleClientId.value = this.config.google_client_id || '';
    }
    this.dom.inputIcsUrl.value = this.config.ics_url || '';
    this.dom.sliderVolume.value = this.config.volume;
    this.dom.labelVolume.textContent = `${this.config.volume}%`;
    this.dom.selectAutoSync.value = String(this.config.auto_sync_min);
    this.dom.selectDecodeSpeed.value = this.config.decode_speed;
    this.dom.selectSoundType.value = this.config.sound_type || 'file';
    this.dom.selectThemeColor.value = this.config.theme_color || 'cyan';
    this.dom.toggleScanlines.checked = this.config.scanlines;
    this.dom.toggleVignette.checked = this.config.vignette !== false;

    this.updateGoogleUI();

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
      google_client_id: (this.dom.inputGoogleClientId?.value || '').trim(),
      ics_url: this.dom.inputIcsUrl.value.trim(),
      volume: parseInt(this.dom.sliderVolume.value, 10),
      auto_sync_min: parseInt(this.dom.selectAutoSync.value, 10),
      decode_speed: this.dom.selectDecodeSpeed.value,
      sound_type: this.dom.selectSoundType.value,
      theme_color: this.dom.selectThemeColor.value,
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
  async syncCalendar(url, isSilent = false) {
    if (!url || url.length < 10) {
      if (!isSilent) alert("유효한 Google Calendar 비공개 iCal 주소를 입력해주세요.");
      return;
    }

    if (!isSilent) this.dom.btnSyncNow.textContent = "동기화 중...";

    try {
      let icsText = "";
      try {
        const resp = await fetch(url);
        icsText = await resp.text();
      } catch (corsErr) {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const resp2 = await fetch(proxyUrl);
        icsText = await resp2.text();
      }

      if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
        throw new Error("올바른 iCal/ICS 형식이 아닙니다.");
      }

      const events = this.parseIcsText(icsText);
      const stages = this.distributeEventsTo3Stages(events.map(e => this.formatEvent(e)));

      this.saveStoredMessages(stages);
      this.config.ics_url = url;
      this.saveConfig(this.config);

      if (!isSilent) {
        this.showToast(`오늘 일정 ${events.length}개를 가져와 [메시지 & STAGE]에 채웠습니다.`);
        this.dom.btnSyncNow.textContent = "즉시 동기화";
      }
    } catch (e) {
      console.error("동기화 실패:", e);
      if (!isSilent) {
        alert(`캘린더 동기화 실패: ${e.message}`);
        this.dom.btnSyncNow.textContent = "즉시 동기화";
      }
    }
  }

  parseIcsText(icsText) {
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth() + 1;
    const todayD = today.getDate();

    const events = [];
    const lines = icsText.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r\n|\n|\r/);
    
    let inEvent = false;
    let curEvent = {};

    for (let line of lines) {
      line = line.trim();
      if (line === "BEGIN:VEVENT") {
        inEvent = true;
        curEvent = {};
      } else if (line === "END:VEVENT") {
        inEvent = false;
        if (this.isEventToday(curEvent, todayY, todayM, todayD)) {
          events.push(curEvent);
        }
      } else if (inEvent && line.includes(":")) {
        const idx = line.indexOf(":");
        const rawKey = line.substring(0, idx);
        const val = line.substring(idx + 1);
        const key = rawKey.split(";")[0];
        curEvent[key] = val;
      }
    }

    events.sort((a, b) => (a.DTSTART || '').localeCompare(b.DTSTART || ''));
    return events;
  }

  isEventToday(ev, y, m, d) {
    const dtstart = ev.DTSTART || "";
    if (!dtstart) return false;

    if (dtstart.length === 8) {
      const ey = parseInt(dtstart.substr(0, 4), 10);
      const em = parseInt(dtstart.substr(4, 2), 10);
      const ed = parseInt(dtstart.substr(6, 2), 10);
      return ey === y && em === m && ed === d;
    }

    if (dtstart.includes("T")) {
      const raw = dtstart.replace("Z", "");
      const ey = parseInt(raw.substr(0, 4), 10);
      const em = parseInt(raw.substr(4, 2), 10);
      const ed = parseInt(raw.substr(6, 2), 10);
      let eh = parseInt(raw.substr(9, 2), 10);

      if (dtstart.endsWith("Z")) {
        const utcDate = new Date(Date.UTC(ey, em - 1, ed, eh));
        const kstDate = new Date(utcDate.getTime() + 9 * 3600 * 1000);
        return kstDate.getFullYear() === y && (kstDate.getMonth() + 1) === m && kstDate.getDate() === d;
      }
      return ey === y && em === m && ed === d;
    }
    return false;
  }

  formatEvent(ev) {
    const summary = ev.SUMMARY || "(제목 없음)";
    const dtstart = ev.DTSTART || "";
    const dtend = ev.DTEND || "";
    let timeInfo = "종일";

    if (dtstart.includes("T")) {
      const rawS = dtstart.replace("Z", "");
      let sh = parseInt(rawS.substr(9, 2), 10);
      let sm = rawS.substr(11, 2);
      if (dtstart.endsWith("Z")) sh = (sh + 9) % 24;
      const startStr = `${String(sh).padStart(2, '0')}:${sm}`;

      if (dtend && dtend.includes("T")) {
        const rawE = dtend.replace("Z", "");
        let eh = parseInt(rawE.substr(9, 2), 10);
        let em = rawE.substr(11, 2);
        if (dtend.endsWith("Z")) eh = (eh + 9) % 24;
        const endStr = `${String(eh).padStart(2, '0')}:${em}`;
        timeInfo = `${startStr} - ${endStr}`;
      } else {
        timeInfo = startStr;
      }
    }

    return { text: summary, time_info: timeInfo };
  }

  distributeEventsTo3Stages(formattedEvents) {
    if (!formattedEvents.length) {
      return [{ stage: 1, messages: [{ text: "오늘 등록된 일정이 없습니다.", time_info: "오늘" }] }];
    }

    const n = 3;
    const base = Math.floor(formattedEvents.length / n);
    const extra = formattedEvents.length % n;
    const stages = [];
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
    return stages;
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
