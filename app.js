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

// ── 기본 설정 및 메시지 ──
const DEFAULT_CONFIG = {
  volume: 80,
  ics_url: '',
  auto_sync_min: 60,
  decode_speed: 'normal', // fast: 0.5s, normal: 0.9s, slow: 1.5s
  scanlines: true,
};

const DEFAULT_MESSAGES = [
  {
    stage: 1,
    messages: [
      { text: "관리자님, 오늘의 일정을 확인하십시오.", time_info: "INFO" },
      { text: "설정(⚙)에서 구글 캘린더를 연동할 수 있습니다.", time_info: "GUIDE" }
    ]
  },
  {
    stage: 2,
    messages: [
      { text: "수감자들의 상태를 점검할 시간입니다.", time_info: "SYSTEM" },
      { text: "황금가지를 향한 여정을 계속하십시오.", time_info: "MISSION" }
    ]
  },
  {
    stage: 3,
    messages: [
      { text: "오늘 하루도 수고하셨습니다. _CLEAR._", time_info: "COMPLETE" }
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
    
    this.animInterval = null;
    this.beepTimeout = null;
    this.audioCtx = null;
    
    this.initDOM();
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
      stageBadge: document.getElementById('stage-badge'),
      msgBadge: document.getElementById('msg-badge'),
      statusBadge: document.getElementById('status-badge'),
      displayDots: document.getElementById('display-dots'),
      displaySubLabel: document.getElementById('display-sub-label'),
      displayMain: document.getElementById('display-main'),
      displayTime: document.getElementById('display-time'),
      progressBar: document.getElementById('progress-container'),
      progressFill: document.getElementById('progress-fill'),
      clock: document.getElementById('clock-display'),
      hintText: document.getElementById('hint-text'),
      
      // 모달 & 폼
      modal: document.getElementById('settings-modal'),
      btnOpenSettings: document.getElementById('btn-open-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      btnResetDefault: document.getElementById('btn-reset-default'),
      btnSyncNow: document.getElementById('btn-sync-now'),
      btnTestSound: document.getElementById('btn-test-sound'),
      btnApplyCustom: document.getElementById('btn-apply-custom-messages'),
      
      inputIcsUrl: document.getElementById('input-ics-url'),
      selectAutoSync: document.getElementById('select-auto-sync'),
      selectDecodeSpeed: document.getElementById('select-decode-speed'),
      sliderVolume: document.getElementById('slider-volume'),
      labelVolume: document.getElementById('label-volume'),
      toggleScanlines: document.getElementById('toggle-scanlines'),
      syncStatusMsg: document.getElementById('sync-status-msg'),
      
      editStage1: document.getElementById('edit-stage-1'),
      editStage2: document.getElementById('edit-stage-2'),
      editStage3: document.getElementById('edit-stage-3'),
      
      audio: document.getElementById('beep-audio'),
      toast: document.getElementById('toast'),
      crtOverlay: document.querySelector('.crt-overlay'),
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

    // 5. 볼륨 슬라이더
    this.dom.sliderVolume.addEventListener('input', (e) => {
      this.dom.labelVolume.textContent = `${e.target.value}%`;
    });

    this.dom.btnTestSound.addEventListener('click', () => {
      const vol = parseInt(this.dom.sliderVolume.value, 10);
      this.playBeep(vol);
    });

    // 6. 설정 저장
    this.dom.btnSaveSettings.addEventListener('click', () => this.saveSettingsFromModal());
    this.dom.btnResetDefault.addEventListener('click', () => this.resetDefaults());

    // 7. 캘린더 동기화
    this.dom.btnSyncNow.addEventListener('click', () => {
      const url = this.dom.inputIcsUrl.value.trim();
      this.syncCalendar(url);
    });

    // 8. 커스텀 메시지 적용
    this.dom.btnApplyCustom.addEventListener('click', () => this.applyCustomMessages());
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
    localStorage.setItem('limbus_beep_messages', JSON.stringify(messages));
    this.currentStageIdx = 0;
    this.currentMsgIdx = 0;
    this.updateDisplay();
    this.updateSyncStatusText();
  }

  applySettings() {
    if (this.dom.crtOverlay) {
      this.dom.crtOverlay.style.display = this.config.scanlines ? 'block' : 'none';
    }
  }

  // ── 오디오 재생 (HTML Audio + Web Audio Synth Fallback) ──
  playBeep(volumePercent = null) {
    const vol = (volumePercent !== null ? volumePercent : this.config.volume) / 100.0;
    if (vol <= 0) return;

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

      gain.gain.setValueAtTime(vol * 0.3, this.audioCtx.currentTime);
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
        this.updateDisplayIdle();
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
    this.updateBadges();
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

    // 1.1초 후 자동 디코딩 시작
    this.beepTimeout = setTimeout(() => {
      this.startDecoding();
    }, 1100);
  }

  // ── 상태 2: DECODING ──
  startDecoding() {
    this.clearTimers();
    this.state = STATE.DECODING;
    this.updateBadges();

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
    this.updateBadges();

    const msg = this.getCurrentMessage();
    if (!msg) return;

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "";
    this.dom.progressBar.classList.remove('visible');
    
    this.dom.displayMain.textContent = msg.text;
    this.dom.displayMain.className = 'main-text accent';

    if (msg.time_info) {
      this.dom.displayTime.textContent = `🕒 ${msg.time_info}`;
      this.dom.displayTime.classList.add('visible');
    } else {
      this.dom.displayTime.classList.remove('visible');
    }
  }

  // ── 상태 4: CLEAR ──
  startClear() {
    this.clearTimers();
    this.state = STATE.CLEAR;
    this.updateBadges();

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
    this.updateBadges();

    this.dom.displayDots.textContent = "★ ALL CLEAR ★";
    this.dom.displaySubLabel.textContent = "모든 메시지 수신 완료";
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');

    this.dom.displayMain.textContent = "수감자 배정 일정 완료";
    this.dom.displayMain.className = 'main-text accent';
  }

  updateDisplayIdle() {
    this.clearTimers();
    this.state = STATE.IDLE;
    this.updateBadges();

    this.dom.displayDots.textContent = "";
    this.dom.displaySubLabel.textContent = "[ 단테 삐삐 대기 중 ]";
    this.dom.displayMain.textContent = "SPACE 를 눌러 시작";
    this.dom.displayMain.className = 'main-text';
    this.dom.displayTime.classList.remove('visible');
    this.dom.progressBar.classList.remove('visible');
  }

  updateDisplay() {
    this.updateDisplayIdle();
  }

  updateBadges() {
    const totalStages = this.messages.length;
    const curStage = Math.min(this.currentStageIdx + 1, totalStages);
    const stage = this.getCurrentStage();
    const totalMsgs = stage && stage.messages ? stage.messages.length : 1;
    const curMsg = Math.min(this.currentMsgIdx + 1, totalMsgs);

    this.dom.stageBadge.textContent = `STAGE ${curStage} / ${totalStages}`;
    this.dom.msgBadge.textContent = `MSG ${curMsg} / ${totalMsgs}`;

    this.dom.statusBadge.textContent = this.state;
    this.dom.statusBadge.className = `status-indicator status-${this.state.toLowerCase()}`;
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

  // ── 설정 모달 로직 ──
  openModal() {
    this.dom.inputIcsUrl.value = this.config.ics_url || '';
    this.dom.sliderVolume.value = this.config.volume;
    this.dom.labelVolume.textContent = `${this.config.volume}%`;
    this.dom.selectAutoSync.value = String(this.config.auto_sync_min);
    this.dom.selectDecodeSpeed.value = this.config.decode_speed;
    this.dom.toggleScanlines.checked = this.config.scanlines;

    // 메시지 에디터 세팅
    this.dom.editStage1.value = this.getStageText(0);
    this.dom.editStage2.value = this.getStageText(1);
    this.dom.editStage3.value = this.getStageText(2);

    this.updateSyncStatusText();
    this.dom.modal.classList.remove('hidden');
  }

  closeModal() {
    this.dom.modal.classList.add('hidden');
  }

  getStageText(stageIdx) {
    if (!this.messages[stageIdx] || !this.messages[stageIdx].messages) return "";
    return this.messages[stageIdx].messages.map(m => m.text).join('\n');
  }

  updateSyncStatusText() {
    const totalEvents = this.messages.reduce((acc, s) => acc + (s.messages ? s.messages.length : 0), 0);
    this.dom.syncStatusMsg.textContent = `현재 등록된 일정: 총 ${totalEvents}개 (${this.messages.length}단계)`;
  }

  saveSettingsFromModal() {
    const newConfig = {
      ics_url: this.dom.inputIcsUrl.value.trim(),
      volume: parseInt(this.dom.sliderVolume.value, 10),
      auto_sync_min: parseInt(this.dom.selectAutoSync.value, 10),
      decode_speed: this.dom.selectDecodeSpeed.value,
      scanlines: this.dom.toggleScanlines.checked,
    };
    this.saveConfig(newConfig);
    this.showToast("설정이 저장되었습니다.");
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

  applyCustomMessages() {
    const stages = [];
    const parseLines = (text) => text.split('\n').map(l => l.trim()).filter(Boolean);

    const s1 = parseLines(this.dom.editStage1.value);
    const s2 = parseLines(this.dom.editStage2.value);
    const s3 = parseLines(this.dom.editStage3.value);

    if (s1.length) stages.push({ stage: 1, messages: s1.map(t => ({ text: t, time_info: "" })) });
    if (s2.length) stages.push({ stage: 2, messages: s2.map(t => ({ text: t, time_info: "" })) });
    if (s3.length) stages.push({ stage: 3, messages: s3.map(t => ({ text: t, time_info: "" })) });

    if (!stages.length) {
      alert("최소 1개 이상의 메시지를 작성해주세요.");
      return;
    }

    this.saveStoredMessages(stages);
    this.showToast("작성된 메시지가 적용되었습니다.");
    this.closeModal();
  }

  // ── Google Calendar ICS 파싱 & 동기화 ──
  async syncCalendar(url, isSilent = false) {
    if (!url || url.length < 10) {
      if (!isSilent) alert("유효한 Google Calendar 비공개 iCal 주소를 입력해주세요.");
      return;
    }

    if (!isSilent) this.dom.btnSyncNow.textContent = "동기화 중...";

    try {
      // CORS 프록시 또는 직접 호출
      let icsText = "";
      try {
        const resp = await fetch(url);
        icsText = await resp.text();
      } catch (corsErr) {
        // 클라이언트 직접 fetch 실패 시 올프록시 또는 로컬 API 프록시 활용
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const resp2 = await fetch(proxyUrl);
        icsText = await resp2.text();
      }

      if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
        throw new Error("올바른 iCal/ICS 형식이 아닙니다.");
      }

      const events = this.parseIcsText(icsText);
      const stages = this.distributeEventsToStages(events);

      this.saveStoredMessages(stages);
      this.config.ics_url = url;
      this.saveConfig(this.config);

      if (!isSilent) {
        this.showToast(`오늘 일정 ${events.length}개를 동기화했습니다!`);
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

    // 시간순 정렬
    events.sort((a, b) => (a.DTSTART || '').localeCompare(b.DTSTART || ''));
    return events;
  }

  isEventToday(ev, y, m, d) {
    const dtstart = ev.DTSTART || "";
    if (!dtstart) return false;

    // YYYYMMDD 형태
    if (dtstart.length === 8) {
      const ey = parseInt(dtstart.substr(0, 4), 10);
      const em = parseInt(dtstart.substr(4, 2), 10);
      const ed = parseInt(dtstart.substr(6, 2), 10);
      return ey === y && em === m && ed === d;
    }

    // YYYYMMDDTHHMMSSZ 형태
    if (dtstart.includes("T")) {
      const raw = dtstart.replace("Z", "");
      const ey = parseInt(raw.substr(0, 4), 10);
      const em = parseInt(raw.substr(4, 2), 10);
      const ed = parseInt(raw.substr(6, 2), 10);
      let eh = parseInt(raw.substr(9, 2), 10);

      // UTC인 경우 KST(+9) 보정
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

  distributeEventsToStages(events, numStages = 3) {
    if (!events.length) {
      return [{ stage: 1, messages: [{ text: "오늘 등록된 일정이 없습니다.", time_info: "오늘" }] }];
    }

    const formatted = events.map(e => this.formatEvent(e));
    const base = Math.floor(formatted.length / numStages);
    const extra = formatted.length % numStages;
    const stages = [];
    let idx = 0;

    for (let s = 0; s < numStages; s++) {
      const count = base + (s < extra ? 1 : 0);
      if (count === 0) continue;
      stages.push({
        stage: s + 1,
        messages: formatted.slice(idx, idx + count)
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
