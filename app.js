const lanes = [
  { id: "crash", label: "CRASH", key: "q", color: "#dff85a", tone: 420 },
  { id: "hihat", label: "HI-HATS", key: "w", color: "#05a8aa", tone: 760 },
  { id: "ride", label: "RIDE", key: "e", color: "#24b8ff", tone: 620 },
  { id: "highTom", label: "HIGH TOM", key: "a", color: "#ffbe0b", tone: 300 },
  { id: "midTom", label: "MID TOM", key: "s", color: "#dc602e", tone: 250 },
  { id: "lowTom", label: "LOW TOM", key: "f", color: "#8f5cff", tone: 180 },
  { id: "snare", label: "SNARE", key: "d", color: "#2f80ed", tone: 210 },
  { id: "kick", label: "KICK", key: " ", color: "#32e875", tone: 90 },
  { id: "pedalHat", label: "PEDAL HI-HAT", key: "c", color: "#eef45b", tone: 520 }
];

const importedTracks = Array.isArray(window.importedTracks) ? window.importedTracks : [];
const storedTheme = window.localStorage.getItem("strk-theme");
const savedSongEdits = readStoredJson("strk-song-edits", {});
let songEdits = savedSongEdits && typeof savedSongEdits === "object" && !Array.isArray(savedSongEdits) ? savedSongEdits : {};
let songOrder = readStoredJson("strk-song-order", importedTracks.map((track) => track.id));

const accuracyPresets = {
  easy: { label: "Easy", window: 140 },
  medium: { label: "Medium", window: 95 },
  precise: { label: "Präzise", window: 55 }
};

const tracks = importedTracks;
if (!Array.isArray(songOrder)) songOrder = importedTracks.map((track) => track.id);

function readStoredJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    return fallback;
  }
}

const sampleManifest = {
  kick: { url: "./assets/samples/kick-acoustic02.wav" },
  snare: { url: "./assets/samples/snare-acoustic02.wav" },
  hihatClosed: { url: "./assets/samples/hihat-acoustic02.wav" },
  hihatOpen: { url: "./assets/samples/openhat-acoustic01.wav" },
  pedalHat: { url: "./assets/samples/hihat-acoustic02.wav" },
  crash: { url: "./assets/samples/crash-acoustic.wav" },
  ride: { url: "./assets/samples/ride-acoustic02.wav" },
  highTom: { url: "./assets/samples/tom-acoustic02.wav", rate: 1.18 },
  midTom: { url: "./assets/samples/tom-acoustic02.wav", rate: 1 },
  lowTom: { url: "./assets/samples/tom-acoustic02.wav", rate: 0.82 },
  bass: { url: "./assets/samples/pastabass-bb2.ogg", rootNote: 46 },
  rhythmGuitar: { url: "./assets/samples/emilyguitar-rhythm-42.wav", rootNote: 42 },
  leadGuitar: { url: "./assets/samples/emilyguitar-lead-57.wav", rootNote: 57 }
};

const generatedBackingBoost = 2.55;

const midiDrumMap = new Map([
  [35, "kick"],
  [36, "kick"],
  [37, "snare"],
  [38, "snare"],
  [40, "snare"],
  [42, "hihat"],
  [44, "pedalHat"],
  [46, "hihat"],
  [26, "hihat"],
  [49, "crash"],
  [55, "crash"],
  [57, "crash"],
  [51, "ride"],
  [53, "ride"],
  [59, "ride"],
  [48, "highTom"],
  [50, "highTom"],
  [45, "midTom"],
  [47, "midTom"],
  [41, "lowTom"],
  [43, "lowTom"]
]);

const state = {
  track: null,
  events: [],
  backingEvents: [],
  selectedTrackId: importedTracks[0]?.id || "",
  libraryQuery: "",
  libraryFilter: "all",
  menuOpen: false,
  startedAt: 0,
  pausedAt: 0,
  playing: false,
  muted: false,
  score: 0,
  combo: 0,
  hits: 0,
  attempts: 0,
  judgement: "Ready",
  flash: new Map(),
  hitEffects: [],
  audio: null,
  backingAudio: null,
  backingAudioUrl: "",
  backingAudioPrimed: false,
  noiseBuffer: null,
  samples: new Map(),
  samplePromises: new Map(),
  zoom: 1.2,
  speed: 1,
  backingVolume: 0.25,
  hitWindow: 95,
  accuracyMode: "medium",
  countIn: true,
  countBeat: -1,
  loopEnabled: false,
  loopStartBar: 1,
  loopEndBar: 4,
  completed: false,
  starting: false,
  scoreAnimation: 0,
  finishTimer: 0,
  seekHintUntil: 0,
  seekingWithPointer: false,
  songMapActiveBar: 0,
  songMapSections: [],
  lastWheelSeek: 0,
  midiAccess: null,
  midiConnected: false,
  midiDeviceName: "",
  midiLastNote: "",
  audioUnlocked: false,
  audioUnlocking: null,
  audioReady: null,
  lastTouchEnd: 0,
  draggedSongId: "",
  editingSongId: "",
  songEditDraft: null
};

const els = {
  app: document.getElementById("drum-app"),
  canvas: document.getElementById("chart"),
  seekBack: document.getElementById("seekBackBtn"),
  seekForward: document.getElementById("seekForwardBtn"),
  library: document.getElementById("libraryBtn"),
  menu: document.getElementById("menuBtn"),
  menuClose: document.getElementById("menuCloseBtn"),
  menuBackdrop: document.getElementById("menuBackdrop"),
  appMenu: document.getElementById("appMenu"),
  playSettings: document.getElementById("playSettingsBtn"),
  playSettingsClose: document.getElementById("playSettingsCloseBtn"),
  playSettingsBackdrop: document.getElementById("playSettingsBackdrop"),
  playSettingsModal: document.getElementById("playSettingsModal"),
  playSettingsLibrary: document.getElementById("playSettingsLibraryBtn"),
  menuSectionButtons: [...document.querySelectorAll("[data-menu-section]")],
  play: document.getElementById("playBtn"),
  restart: document.getElementById("restartBtn"),
  mute: document.getElementById("muteBtn"),
  midi: document.getElementById("midiBtn"),
  zoom: document.getElementById("zoomRange"),
  zoomLabel: document.getElementById("zoomLabel"),
  speed: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  backingVolume: document.getElementById("backingVolumeRange"),
  backingVolumeLabel: document.getElementById("backingVolumeLabel"),
  hitWindow: document.getElementById("hitWindowRange"),
  hitWindowLabel: document.getElementById("hitWindowLabel"),
  accuracyButtons: [...document.querySelectorAll(".preset-btn")],
  completionOverlay: document.getElementById("completionOverlay"),
  completionTitle: document.getElementById("completionTitle"),
  completionScore: document.getElementById("completionScore"),
  completionHits: document.getElementById("completionHits"),
  completionMisses: document.getElementById("completionMisses"),
  completionAccuracy: document.getElementById("completionAccuracy"),
  completionReplay: document.getElementById("completionReplay"),
  completionLibrary: document.getElementById("completionLibrary"),
  currentSongTitle: document.getElementById("currentSongTitle"),
  currentSongBpm: document.getElementById("currentSongBpm"),
  midiStatus: document.getElementById("midiStatus"),
  countInToggle: document.getElementById("countInToggle"),
  countInLabel: document.getElementById("countInLabel"),
  loopPanel: document.getElementById("loopPanel"),
  loopToggle: document.getElementById("loopToggle"),
  loopLabel: document.getElementById("loopLabel"),
  loopRange: document.getElementById("loopRange"),
  loopStartLabel: document.getElementById("loopStartLabel"),
  loopEndLabel: document.getElementById("loopEndLabel"),
  loopLengthLabel: document.getElementById("loopLengthLabel"),
  startScreen: document.getElementById("startScreen"),
  selectedSongTitle: document.getElementById("selectedSongTitle"),
  selectedSongMeta: document.getElementById("selectedSongMeta"),
  selectedSongPlay: document.getElementById("selectedSongPlay"),
  themeToggle: document.getElementById("themeToggle"),
  songSearch: document.getElementById("songSearch"),
  libraryTabs: [...document.querySelectorAll(".library-tab")],
  songList: document.getElementById("songList"),
  songEditorList: document.getElementById("songEditorList"),
  resetSongEdits: document.getElementById("resetSongEditsBtn"),
  stepButtons: [...document.querySelectorAll(".step-btn")],
  progress: document.getElementById("progressBar"),
  songMap: document.getElementById("songMap"),
  songMapCurrentBar: document.getElementById("songMapCurrentBar"),
  songMapTotalBars: document.getElementById("songMapTotalBars"),
  score: document.getElementById("score"),
  combo: document.getElementById("combo"),
  accuracy: document.getElementById("accuracy"),
  judgement: document.getElementById("judgement"),
  laneButtons: [...document.querySelectorAll(".lane-buttons button")]
};

const ctx = els.canvas.getContext("2d");

function chartColors() {
  const light = document.documentElement.dataset.theme === "light";
  return {
    outline: light ? "rgba(5,28,23,0.58)" : "rgba(4,8,7,0.64)",
    markerDepth: light ? "rgba(5,28,23,0.48)" : "rgba(0,0,0,0.56)",
    markerEdge: light ? "rgba(5,28,23,0.18)" : "rgba(255,255,255,0.16)",
    markerInset: light ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.13)",
    shadow: light ? "rgba(9,20,17,0.22)" : "rgba(0,0,0,0.42)",
    shine: light ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.36)",
    shineSoft: light ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.18)",
    chartA: light ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.06)",
    chartB: light ? "rgba(196,230,42,0.14)" : "rgba(255,255,255,0.034)",
    chartC: light ? "rgba(0,165,150,0.075)" : "rgba(128,220,199,0.026)",
    stripe: light ? "rgba(12,35,30,0.035)" : "rgba(255,255,255,0.034)",
    gridMajor: light ? "rgba(31,56,50,0.30)" : "rgba(227,236,231,0.40)",
    gridMinor: light ? "rgba(31,56,50,0.14)" : "rgba(227,236,231,0.19)",
    gridFine: light ? "rgba(31,56,50,0.07)" : "rgba(227,236,231,0.075)",
    labelBg: light ? "rgba(246,252,241,0.92)" : "rgba(5,7,8,0.86)",
    labelText: light ? "#16231f" : "#dff85a",
    cue: light ? "#a8ef00" : "#dff85a",
    early: "#00d6bd",
    late: "#ffb000",
    loopFill: light ? "rgba(126,179,34,0.10)" : "rgba(223,248,90,0.065)",
    loopLine: light ? "rgba(126,179,34,0.68)" : "rgba(223,248,90,0.72)",
    goodFlash: light ? "rgba(42,190,100,0.16)" : "rgba(48,209,126,0.20)",
    badFlash: light ? "rgba(230,70,88,0.16)" : "rgba(255,88,112,0.20)"
  };
}

function buildEvents(track) {
  if (Array.isArray(track.events)) {
    return track.events
      .filter((event) => lanes.some((lane) => lane.id === event.lane) && Number.isFinite(event.time))
      .map((event) => ({
        time: event.time,
        lane: event.lane,
        variant: event.variant || "",
        hit: false,
        missed: false,
        played: false,
        skipped: false
      }))
      .sort((a, b) => a.time - b.time);
  }

  const beatMs = 60000 / track.bpm;
  const stepMs = beatMs / 2;
  const events = [];
  const steps = track.bars * 16;

  for (let step = 0; step < steps; step++) {
    const hits = track.pattern[step % track.pattern.length];
    for (const lane of hits) {
      events.push({ time: step * stepMs, lane, variant: "", hit: false, missed: false, played: false, skipped: false });
    }
  }

  for (const item of track.offsets || []) {
    for (let bar = 0; bar < track.bars; bar++) {
      events.push({ time: (bar * 16 + item.step) * stepMs, lane: item.lane, variant: "", hit: false, missed: false, played: false, skipped: false });
    }
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

function trackDuration(track) {
  if (Number.isFinite(track.durationMs)) return track.durationMs;
  if (Array.isArray(track.events) && track.events.length > 0) {
    return Math.max(...track.events.map((event) => event.time)) + 2000;
  }
  return track.bars * 16 * (60000 / track.bpm / 2);
}

function beatMs() {
  return 60000 / (state.track?.bpm || 100);
}

function barMs() {
  return beatMs() * 4;
}

function totalBars() {
  if (Number.isFinite(state.track?.bars)) return state.track.bars;
  return Math.max(1, Math.ceil(trackDuration(state.track) / barMs()));
}

function countInDuration() {
  return beatMs() * 3;
}

function loopStartTime() {
  return (state.loopStartBar - 1) * barMs();
}

function loopEndTime() {
  return Math.min(trackDuration(state.track), state.loopEndBar * barMs());
}

function loopLengthBars() {
  return Math.max(1, state.loopEndBar - state.loopStartBar + 1);
}

function currentBarNumber() {
  return Math.min(totalBars(), Math.max(1, Math.floor(currentTime() / barMs()) + 1));
}

function setLoopFromCurrentBar(length = loopLengthBars()) {
  const maxBars = totalBars();
  const safeLength = Math.min(Math.max(1, length), maxBars);
  const start = Math.min(currentBarNumber(), Math.max(1, maxBars - safeLength + 1));
  state.loopStartBar = start;
  state.loopEndBar = Math.min(maxBars, start + safeLength - 1);
}

function practiceStartTime() {
  return state.loopEnabled ? loopStartTime() : 0;
}

function practiceEndTime() {
  return state.loopEnabled ? loopEndTime() : trackDuration(state.track);
}

function isEventInPracticeRange(event) {
  if (!state.loopEnabled) return true;
  return event.time >= loopStartTime() && event.time < loopEndTime();
}

function resetEventsInRange(start, end) {
  for (const event of state.events) {
    if (event.time >= start && event.time < end) {
      event.hit = false;
      event.missed = false;
      event.played = false;
      event.skipped = false;
    }
  }
  for (const event of state.backingEvents) {
    if (event.time >= start && event.time < end) {
      event.played = false;
    }
  }
}

function hasAudioBacking() {
  return Boolean(state.track?.backingAudioUrl);
}

function prepareBackingAudio() {
  const url = state.track?.backingAudioUrl || "";
  if (!url) {
    if (state.backingAudio) {
      state.backingAudio.pause();
      state.backingAudio.removeAttribute("src");
      state.backingAudio.load();
    }
    state.backingAudio = null;
    state.backingAudioUrl = "";
    state.backingAudioPrimed = false;
    return null;
  }

  if (!state.backingAudio || state.backingAudioUrl !== url) {
    if (state.backingAudio) state.backingAudio.pause();
    state.backingAudio = new Audio(url);
    state.backingAudio.preload = "auto";
    state.backingAudio.playsInline = true;
    state.backingAudioUrl = url;
    state.backingAudioPrimed = false;
  }

  state.backingAudio.playbackRate = state.speed;
  state.backingAudio.volume = state.muted ? 0 : state.backingVolume;
  return state.backingAudio;
}

function backingAudioTimeSeconds() {
  return Math.max(0, currentTime() / 1000);
}

function setBackingAudioPosition(time = currentTime()) {
  const audio = prepareBackingAudio();
  if (!audio) return;
  const maxTime = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.02) : Infinity;
  const next = Math.min(Math.max(0, time / 1000), maxTime);
  if (Math.abs(audio.currentTime - next) > 0.08) audio.currentTime = next;
}

function stopBackingAudio(syncPosition = true) {
  const audio = state.backingAudio;
  if (!audio) return;
  audio.pause();
  if (syncPosition) setBackingAudioPosition();
}

function syncBackingAudio(allowPlay = false) {
  const audio = prepareBackingAudio();
  if (!audio) return;
  audio.playbackRate = state.speed;
  audio.volume = state.muted ? 0 : state.backingVolume;

  const songTime = currentTime();
  if (!state.playing || state.completed || songTime < 0) {
    stopBackingAudio(true);
    return;
  }

  const target = backingAudioTimeSeconds();
  if (Math.abs(audio.currentTime - target) > 0.16) audio.currentTime = target;
  if (audio.paused && allowPlay) {
    audio.play()
      .then(() => {
        state.backingAudioPrimed = true;
      })
      .catch((error) => {
        console.warn("MP3 backing playback deferred", error);
      });
  }
}

function primeBackingAudioFromGesture() {
  const audio = prepareBackingAudio();
  if (!audio || state.backingAudioPrimed) return;
  const previousVolume = audio.volume;
  audio.volume = 0;
  setBackingAudioPosition();
  audio.play()
    .then(() => {
      state.backingAudioPrimed = true;
      audio.volume = state.muted ? 0 : state.backingVolume;
      setBackingAudioPosition();
      if (!state.playing || currentTime() < 0) audio.pause();
    })
    .catch((error) => {
      audio.volume = previousVolume;
      console.warn("MP3 backing unlock deferred", error);
    });
}

function setTrack(trackId) {
  state.track = tracks.find((track) => track.id === trackId) || tracks[0];
  state.selectedTrackId = state.track.id;
  state.loopStartBar = 1;
  state.loopEndBar = Math.min(4, totalBars());
  state.songMapActiveBar = 0;
  prepareBackingAudio();
  reset();
  updatePracticeControls();
  updatePlayerMeta();
  renderSongCards();
}

function reset() {
  state.events = buildEvents(state.track);
  state.backingEvents = !hasAudioBacking() && Array.isArray(state.track?.backingEvents)
    ? state.track.backingEvents
      .filter((event) => Number.isFinite(event.time) && Number.isFinite(event.note))
      .map((event) => ({
        time: event.time,
        duration: Number.isFinite(event.duration) ? event.duration : 220,
        note: event.note,
        velocity: Number.isFinite(event.velocity) ? event.velocity : 80,
        part: event.part || "guitar",
        played: false
      }))
      .sort((a, b) => a.time - b.time)
    : [];
  state.startedAt = performance.now();
  state.pausedAt = 0;
  state.playing = false;
  state.score = 0;
  state.combo = 0;
  state.hits = 0;
  state.attempts = 0;
  state.judgement = "Ready";
  state.completed = false;
  cancelAnimationFrame(state.scoreAnimation);
  clearTimeout(state.finishTimer);
  hideCompletion();
  els.app.classList.remove("is-finishing");
  state.flash.clear();
  state.hitEffects = [];
  stopBackingAudio(false);
  setBackingAudioPosition(0);
  updateStats();
  renderSongMap();
  if (state.track) draw();
}

function currentTime() {
  if (state.playing) return state.pausedAt + (performance.now() - state.startedAt) * state.speed;
  return state.pausedAt;
}

function seekBounds() {
  return {
    start: practiceStartTime(),
    end: practiceEndTime()
  };
}

function clampSeekTime(time) {
  const { start, end } = seekBounds();
  return Math.min(end, Math.max(start, time));
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function markEventsForSeek(time) {
  const start = practiceStartTime();
  const end = practiceEndTime();
  for (const event of state.events) {
    if (!isEventInPracticeRange(event)) continue;
    if (event.time < time) {
      event.hit = false;
      event.missed = false;
      event.played = true;
      event.skipped = true;
    } else {
      event.hit = false;
      event.missed = false;
      event.played = false;
      event.skipped = false;
    }
  }
  for (const event of state.backingEvents) {
    event.played = event.time < time && event.time >= start && event.time < end;
  }
}

function seekTo(time) {
  const next = clampSeekTime(time);
  state.pausedAt = next;
  state.startedAt = performance.now();
  state.completed = false;
  state.countBeat = -1;
  state.judgement = `Start ${formatTime(next)}`;
  state.seekHintUntil = performance.now() + 720;
  hideCompletion();
  els.app.classList.remove("is-finishing");
  markEventsForSeek(next);
  syncBackingAudio(state.playing);
  updateStats();
  updateSongMap();
  draw();
}

function canvasTimeFromPointer(event) {
  const rect = els.canvas.getBoundingClientRect();
  const { hitX, pxPerMs } = chartMetrics();
  const x = event.clientX - rect.left;
  return currentTime() + (x - hitX) / pxPerMs;
}

function seekFromPointer(event) {
  if (state.playing || !state.track) return;
  seekTo(canvasTimeFromPointer(event));
}

function laneFromChartPointer(event) {
  const rect = els.canvas.getBoundingClientRect();
  const { laneAreaHeight, laneHeight } = chartMetrics();
  const y = event.clientY - rect.top;
  if (y < 0 || y > laneAreaHeight) return null;
  const laneIndex = Math.max(0, Math.min(lanes.length - 1, Math.floor(y / laneHeight)));
  return lanes[laneIndex];
}

function seekByBars(direction) {
  if (state.playing || !state.track) return;
  seekTo(currentTime() + direction * barMs());
}

function seekByWheel(event) {
  if (state.playing || !state.track) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!delta) return;
  event.preventDefault();
  const now = performance.now();
  if (now - state.lastWheelSeek < 260) return;
  state.lastWheelSeek = now;
  seekByBars(Math.sign(delta));
}

function beginPlayback(forceStart = false) {
  if (state.completed && !forceStart) {
    restart();
    return;
  }
  hideCompletion();
  if (forceStart) state.pausedAt = practiceStartTime();
  const start = practiceStartTime();
  if (state.countIn && state.pausedAt <= start + 8) {
    state.pausedAt = start - countInDuration();
    state.countBeat = -1;
  }
  markEventsForSeek(Math.max(start, state.pausedAt));
  state.startedAt = performance.now();
  state.playing = true;
  els.play.classList.add("is-playing");
  syncBackingAudio(true);
}

function togglePlay() {
  if (state.playing) {
    state.pausedAt = currentTime();
    state.playing = false;
    els.play.classList.remove("is-playing");
    stopBackingAudio(true);
  } else {
    primeBackingAudioFromGesture();
    ensureAudio()
      .then(() => primeMobileAudio())
      .catch((error) => {
        console.warn("Audio playback deferred", error);
      });
    beginPlayback();
  }
}

function restart() {
  reset();
  beginPlayback(true);
}

function replayReady() {
  reset();
}

function openStartScreen() {
  state.pausedAt = currentTime();
  state.playing = false;
  state.starting = false;
  setPlaySettingsOpen(false);
  hideCompletion();
  els.play.classList.remove("is-playing");
  els.app.classList.remove("is-playing", "is-starting");
  stopBackingAudio(true);
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  window.localStorage.setItem("strk-theme", nextTheme);
  if (!els.themeToggle) return;
  const isLight = nextTheme === "light";
  els.themeToggle.setAttribute("aria-pressed", String(isLight));
  els.themeToggle.setAttribute("aria-label", isLight ? "Dark mode einschalten" : "Light mode einschalten");
  if (state.track) draw();
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
}

function setMenuOpen(open) {
  state.menuOpen = open;
  els.app.classList.toggle("menu-is-open", open);
  els.menu?.setAttribute("aria-expanded", String(open));
  els.appMenu?.setAttribute("aria-hidden", String(!open));
  if (els.menuBackdrop) els.menuBackdrop.hidden = !open;
  if (open) renderSongEditor();
}

function setPlaySettingsOpen(open) {
  els.app.classList.toggle("play-settings-is-open", open);
  els.playSettings?.setAttribute("aria-expanded", String(open));
  els.playSettingsModal?.setAttribute("aria-hidden", String(!open));
  if (els.playSettingsBackdrop) els.playSettingsBackdrop.hidden = !open;
}

function focusMenuSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function updateHeaderScrollState() {
  const scrolled = (els.startScreen?.scrollTop || 0) > 14;
  els.app.classList.toggle("has-library-scroll", scrolled);
}

function startPractice(trackId) {
  if (state.starting) return;
  ensureAudio()
    .then(() => primeMobileAudio())
    .catch((error) => {
      console.warn("Audio start deferred", error);
    });
  state.starting = true;
  els.app.classList.add("is-starting");
  window.setTimeout(() => {
    setTrack(trackId);
    els.app.classList.add("is-playing");
    els.app.classList.remove("is-starting");
    state.starting = false;
    requestAnimationFrame(resizeCanvas);
  }, 260);
}

function selectedLibraryTrack() {
  return tracks.find((track) => track.id === state.selectedTrackId) || tracks[0];
}

function trackMeta(track) {
  const duration = trackDuration(track);
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.round((duration % 60000) / 1000).toString().padStart(2, "0");
  const eventCount = Array.isArray(track.events) ? track.events.length : buildEvents(track).length;
  return { bpm: `${track.bpm || "?"} BPM`, duration: `${minutes}:${seconds}`, notes: `${eventCount} hits`, eventCount };
}

function trackIntensity(track) {
  const meta = trackMeta(track);
  const durationMinutes = Math.max(0.5, trackDuration(track) / 60000);
  const notesPerMinute = meta.eventCount / durationMinutes;
  if (notesPerMinute > 145 || track.bpm > 135) return "Intense";
  if (notesPerMinute > 95 || track.bpm > 105) return "Groove";
  return "Warmup";
}

function trackSource(track) {
  return importedTracks.some((item) => item.id === track.id) ? "Imported" : "Demo";
}

function trackSourceFilter(track) {
  return trackSource(track) === "Imported" ? "imported" : "built-in";
}

function trackDisplayParts(track) {
  const edit = songEdits[track.id] || {};
  const [title, ...rest] = track.name.split(" - ");
  const subtitle = rest.length ? rest.join(" - ") : trackSource(track);
  return {
    title: (edit.title || title).trim(),
    subtitle: (edit.artist || subtitle).trim(),
    image: edit.image || ""
  };
}

function orderedTracks() {
  const known = new Set(tracks.map((track) => track.id));
  const ordered = songOrder
    .filter((id) => known.has(id))
    .map((id) => tracks.find((track) => track.id === id))
    .filter(Boolean);
  const missing = tracks.filter((track) => !songOrder.includes(track.id));
  return [...ordered, ...missing];
}

function persistSongSettings() {
  window.localStorage.setItem("strk-song-edits", JSON.stringify(songEdits));
  window.localStorage.setItem("strk-song-order", JSON.stringify(songOrder));
}

function updateSongEdit(trackId, patch) {
  const current = songEdits[trackId] || {};
  songEdits = { ...songEdits, [trackId]: { ...current, ...patch } };
  persistSongSettings();
  renderSongCards();
  renderSongEditor();
  updateSelectedSongPanel();
}

function startSongEdit(trackId) {
  const track = tracks.find((item) => item.id === trackId);
  if (!track) return;
  const display = trackDisplayParts(track);
  state.editingSongId = trackId;
  state.songEditDraft = {
    title: display.title,
    artist: display.subtitle
  };
  renderSongEditor();
  requestAnimationFrame(() => {
    els.songEditorList?.querySelector(`[data-track-id="${trackId}"][data-edit-field="title"]`)?.focus();
  });
}

function updateSongEditDraft(trackId, field, value) {
  if (state.editingSongId !== trackId || !state.songEditDraft) return;
  state.songEditDraft = { ...state.songEditDraft, [field]: value };
}

function saveSongEdit(trackId) {
  if (state.editingSongId !== trackId || !state.songEditDraft) return;
  updateSongEdit(trackId, {
    title: state.songEditDraft.title,
    artist: state.songEditDraft.artist
  });
  state.editingSongId = "";
  state.songEditDraft = null;
  renderSongEditor();
}

function cancelSongEdit(trackId) {
  if (state.editingSongId !== trackId) return;
  state.editingSongId = "";
  state.songEditDraft = null;
  renderSongEditor();
}

function reorderSong(trackId, targetId) {
  if (!trackId || !targetId || trackId === targetId) return;
  const order = orderedTracks().map((track) => track.id);
  const fromIndex = order.indexOf(trackId);
  const toIndex = order.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0) return;
  const [item] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, item);
  songOrder = order;
  persistSongSettings();
  renderSongCards();
  renderSongEditor();
}

function visibleLibraryTracks() {
  const query = state.libraryQuery.trim().toLowerCase();
  return orderedTracks().filter((track) => {
    const matchesFilter = state.libraryFilter === "all" || trackSourceFilter(track) === state.libraryFilter;
    const display = trackDisplayParts(track);
    const matchesQuery = !query || `${track.name} ${display.title} ${display.subtitle}`.toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });
}

function updateSelectedSongPanel() {
  const track = selectedLibraryTrack();
  const meta = trackMeta(track);
  const display = trackDisplayParts(track);
  els.selectedSongTitle.textContent = display.title;
  els.selectedSongMeta.innerHTML = `
    <span><i class="fa-solid fa-gauge" aria-hidden="true"></i>${meta.bpm}</span>
    <span><i class="fa-solid fa-clock" aria-hidden="true"></i>${meta.duration}</span>
    <span><i class="fa-solid fa-drum" aria-hidden="true"></i>${meta.notes}</span>
  `;
}

function selectLibraryTrack(trackId) {
  state.selectedTrackId = trackId;
  renderSongCards();
  updateSelectedSongPanel();
}

function renderSongCards() {
  if (!els.songList) return;
  els.songList.replaceChildren();
  const visibleTracks = visibleLibraryTracks();
  if (visibleTracks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.innerHTML = `
      <strong>Keine Tracks gefunden</strong>
      <span>Ändere die Suche oder den Filter.</span>
    `;
    els.songList.appendChild(empty);
    return;
  }

  for (const track of visibleTracks) {
    const display = trackDisplayParts(track);
    const meta = trackMeta(track);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `song-card${track.id === state.selectedTrackId ? " is-selected" : ""}`;
    button.dataset.trackId = track.id;
    button.setAttribute("aria-pressed", String(track.id === state.selectedTrackId));
    button.innerHTML = `
      <span class="song-icon"></span>
      <span class="song-main">
        <span class="song-title"></span>
        <span class="song-line">
          <span class="song-artist"></span>
          <span class="song-inline-meta"></span>
        </span>
      </span>
    `;
    const icon = button.querySelector(".song-icon");
    if (display.image) {
      const image = document.createElement("img");
      image.src = display.image;
      image.alt = "";
      image.loading = "lazy";
      icon.appendChild(image);
    } else {
      icon.innerHTML = `<i class="fa-solid fa-music" aria-hidden="true"></i>`;
    }
    button.querySelector(".song-title").textContent = display.title;
    button.querySelector(".song-artist").textContent = display.subtitle;
    button.querySelector(".song-inline-meta").textContent = `${meta.bpm} / ${meta.duration} / ${meta.notes}`;
    button.addEventListener("click", () => selectLibraryTrack(track.id));
    els.songList.appendChild(button);
  }
}

function renderSongEditor() {
  if (!els.songEditorList) return;
  els.songEditorList.replaceChildren();
  orderedTracks().forEach((track) => {
    const display = trackDisplayParts(track);
    const isEditing = state.editingSongId === track.id;
    const draft = isEditing && state.songEditDraft ? state.songEditDraft : display;
    const item = document.createElement("article");
    item.className = `song-editor-item${isEditing ? " is-editing" : ""}`;
    item.dataset.trackId = track.id;
    item.innerHTML = `
      <button class="drag-handle" data-drag-song="${track.id}" type="button" draggable="true" aria-label="${display.title} verschieben">
        <i class="fa-solid fa-grip-lines" aria-hidden="true"></i>
      </button>
      <div class="editor-summary">
        <strong class="editor-title"></strong>
        <span class="editor-artist"></span>
      </div>
      ${isEditing ? `
        <div class="editor-confirm-actions">
          <button class="editor-icon-btn is-save" data-save-song="${track.id}" type="button" aria-label="Änderungen speichern">
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </button>
          <button class="editor-icon-btn is-cancel" data-cancel-song="${track.id}" type="button" aria-label="Änderungen verwerfen">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      ` : `
        <button class="editor-icon-btn" data-edit-song="${track.id}" type="button" aria-label="${display.title} bearbeiten">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
      `}
      <div class="editor-fields" ${isEditing ? "" : "hidden"}>
        <label>
          <span>Titel</span>
          <input data-edit-field="title" data-track-id="${track.id}" type="text">
        </label>
        <label>
          <span>Interpret</span>
          <input data-edit-field="artist" data-track-id="${track.id}" type="text">
        </label>
      </div>
    `;
    item.querySelector(".editor-title").textContent = display.title;
    item.querySelector(".editor-artist").textContent = display.subtitle;
    if (isEditing) {
      item.querySelector('[data-edit-field="title"]').value = draft.title;
      item.querySelector('[data-edit-field="artist"]').value = draft.artist;
    }
    els.songEditorList.appendChild(item);
  });
}

function setSpeed(speed) {
  const songTime = currentTime();
  state.speed = speed;
  if (state.playing) {
    state.pausedAt = songTime;
    state.startedAt = performance.now();
  }
  syncBackingAudio(state.playing);
  els.speedLabel.textContent = `${Math.round(speed * 100)}%`;
  updatePlayerMeta();
}

function setHitWindow(milliseconds) {
  state.hitWindow = milliseconds;
}

function setBackingVolume(value) {
  const min = Number(els.backingVolume.min);
  const max = Number(els.backingVolume.max);
  const next = Math.min(max, Math.max(min, value));
  els.backingVolume.value = String(next);
  state.backingVolume = next / 100;
  els.backingVolumeLabel.textContent = next === 0 ? "Off" : `${next}%`;
  syncBackingAudio(state.playing);
}

function setAccuracyMode(mode) {
  const preset = accuracyPresets[mode] || accuracyPresets.medium;
  state.accuracyMode = mode;
  state.hitWindow = preset.window;
  els.hitWindow.value = String(preset.window);
  els.hitWindowLabel.textContent = preset.label;
  for (const button of els.accuracyButtons) {
    button.classList.toggle("is-selected", button.dataset.accuracy === mode);
  }
}

function updatePracticeControls() {
  const maxBars = totalBars();
  state.loopStartBar = Math.min(Math.max(1, state.loopStartBar), maxBars);
  state.loopEndBar = Math.min(Math.max(state.loopStartBar, state.loopEndBar), maxBars);
  const length = loopLengthBars();
  els.countInToggle.classList.toggle("is-on", state.countIn);
  els.countInToggle.setAttribute("aria-pressed", String(state.countIn));
  els.countInLabel.textContent = state.countIn ? "1 2 3" : "Off";
  els.loopPanel.classList.toggle("is-on", state.loopEnabled);
  els.loopToggle.classList.toggle("is-on", state.loopEnabled);
  els.loopToggle.setAttribute("aria-expanded", String(state.loopEnabled));
  els.loopLabel.textContent = state.loopEnabled ? `${length}T` : "Off";
  els.loopStartLabel.textContent = state.loopStartBar.toString();
  els.loopEndLabel.textContent = state.loopEndBar.toString();
  els.loopLengthLabel.textContent = `${length}T`;
  els.app.classList.toggle("has-loop", state.loopEnabled);
  updateSongMap();
}

function songMapSummaries() {
  const bars = totalBars();
  const summaries = Array.from({ length: bars }, (_, index) => ({
    bar: index + 1,
    hits: 0,
    cymbals: 0,
    toms: 0,
    kicks: 0,
    snare: 0,
    openHat: 0,
    downbeatCrash: false
  }));
  const length = barMs();
  for (const event of state.events) {
    const bar = Math.min(bars, Math.max(1, Math.floor(event.time / length) + 1));
    const summary = summaries[bar - 1];
    summary.hits += 1;
    if (event.lane === "crash" || event.lane === "ride" || event.lane === "hihat") summary.cymbals += 1;
    if (event.lane === "highTom" || event.lane === "midTom" || event.lane === "lowTom") summary.toms += 1;
    if (event.lane === "kick") summary.kicks += 1;
    if (event.lane === "snare") summary.snare += 1;
    if (event.variant === "open") summary.openHat += 1;
    if (event.lane === "crash" && event.time - (bar - 1) * length < beatMs() * 0.18) summary.downbeatCrash = true;
  }
  return summaries;
}

function songMapIntensity(summary, maxHits) {
  if (summary.hits === 0) return "rest";
  const ratio = maxHits > 0 ? summary.hits / maxHits : 0;
  if (summary.toms >= 3 || ratio >= 0.72) return "fill";
  if (summary.cymbals > 0 && summary.kicks > 0 && ratio >= 0.42) return "groove";
  return "light";
}

function songMapRole(summary, maxHits) {
  if (summary.hits === 0) return "break";
  const ratio = maxHits > 0 ? summary.hits / maxHits : 0;
  if (summary.toms >= 3 || ratio >= 0.72) return "fill";
  if (summary.openHat >= 2 || summary.downbeatCrash) return "part";
  return "groove";
}

function songMapSignature(summary, maxHits) {
  const density = Math.min(4, Math.floor((summary.hits / Math.max(1, maxHits)) * 5));
  const cymbalWeight = Math.min(3, Math.floor((summary.cymbals / Math.max(1, summary.hits)) * 4));
  const tomWeight = Math.min(3, Math.floor((summary.toms / Math.max(1, summary.hits)) * 5));
  const kickSnare = `${Math.min(3, summary.kicks)}:${Math.min(3, summary.snare)}`;
  return `${density}-${cymbalWeight}-${tomWeight}-${kickSnare}-${summary.openHat > 0 ? 1 : 0}`;
}

function detectSongSections(summaries, maxHits) {
  if (summaries.length === 0) return [];
  const sections = [{ bar: 1, label: "Intro", role: songMapRole(summaries[0], maxHits) }];
  let lastStart = 1;
  let partIndex = 0;

  for (let index = 1; index < summaries.length; index += 1) {
    const current = summaries[index];
    const previous = summaries[index - 1];
    const currentRole = songMapRole(current, maxHits);
    const previousRole = songMapRole(previous, maxHits);
    const currentSignature = songMapSignature(current, maxHits);
    const previousSignature = songMapSignature(previous, maxHits);
    const hitDelta = Math.abs(current.hits - previous.hits) / Math.max(1, maxHits);
    const cymbalDelta = Math.abs(current.cymbals - previous.cymbals) / Math.max(1, maxHits);
    const enoughDistance = current.bar - lastStart >= 4;

    let score = 0;
    if (currentRole !== previousRole) score += 1.15;
    if (currentSignature !== previousSignature) score += 0.75;
    if (hitDelta >= 0.32) score += 0.8;
    if (cymbalDelta >= 0.22) score += 0.55;
    if (current.downbeatCrash && current.hits > 0) score += 0.85;
    if (previousRole === "fill" && currentRole !== "fill") score += 0.75;
    if (previous.hits === 0 && current.hits > 0) score += 1.2;
    if (current.hits === 0 && previous.hits > 0) score += 1;

    const phraseBoundary = current.bar > 1 && (current.bar - 1) % 8 === 0;
    if (phraseBoundary && score >= 1.2) score += 0.45;

    if (enoughDistance && score >= 2.1) {
      let label;
      if (currentRole === "break") {
        label = "Break";
      } else if (currentRole === "fill") {
        label = "Fill";
      } else {
        label = String.fromCharCode(65 + Math.min(25, partIndex));
        partIndex += 1;
      }
      sections.push({ bar: current.bar, label, role: currentRole });
      lastStart = current.bar;
    }
  }

  if (sections.length === 1 && summaries.length >= 24) {
    for (let bar = 17; bar <= summaries.length; bar += 16) {
      partIndex += 1;
      sections.push({ bar, label: String.fromCharCode(65 + Math.min(25, partIndex)), role: "part" });
    }
  }

  return sections;
}

function shortSectionLabel(label) {
  if (label === "Intro") return "I";
  if (label === "Break") return "Br";
  if (label === "Fill") return "F";
  return label;
}

function renderSongMap() {
  if (!els.songMap || !state.track) return;
  const summaries = songMapSummaries();
  const maxHits = Math.max(1, ...summaries.map((summary) => summary.hits));
  state.songMapSections = detectSongSections(summaries, maxHits);
  const sectionByBar = new Map(state.songMapSections.map((section) => [section.bar, section]));
  const html = summaries.map((summary) => {
    const intensity = songMapIntensity(summary, maxHits);
    const showLabel = summary.bar === 1 || summary.bar % 8 === 0;
    const section = sectionByBar.get(summary.bar);
    const height = Math.max(0.28, Math.min(1, summary.hits / maxHits));
    const sectionTitle = section ? ` · neuer Part: ${section.label}` : "";
    const title = `Takt ${summary.bar} · ${summary.hits} Hits${sectionTitle}`;
    return `
      <button class="song-map-bar is-${intensity}${section ? ` is-section-start is-section-${section.role}` : ""}" type="button" role="listitem" data-song-map-bar="${summary.bar}" style="--bar-fill: ${height}" aria-label="${title}" title="${title}">
        <span class="bar-index">${showLabel ? summary.bar : ""}</span>
        ${section ? `<span class="section-label">${shortSectionLabel(section.label)}</span>` : ""}
      </button>
    `;
  }).join("");
  els.songMap.innerHTML = html;
  if (els.songMapTotalBars) els.songMapTotalBars.textContent = String(summaries.length || 1);
  state.songMapActiveBar = 0;
  updateSongMap(true);
}

function updateSongMap(force = false) {
  if (!els.songMap || !state.track) return;
  const currentBar = currentBarNumber();
  if (els.songMapCurrentBar) els.songMapCurrentBar.textContent = String(currentBar);

  const loopStart = state.loopEnabled ? state.loopStartBar : 0;
  const loopEnd = state.loopEnabled ? state.loopEndBar : 0;
  const needsClassUpdate = force || state.songMapActiveBar !== currentBar;
  if (!needsClassUpdate && els.songMap.dataset.loopStart === String(loopStart) && els.songMap.dataset.loopEnd === String(loopEnd)) return;

  state.songMapActiveBar = currentBar;
  els.songMap.dataset.loopStart = String(loopStart);
  els.songMap.dataset.loopEnd = String(loopEnd);
  for (const item of els.songMap.querySelectorAll("[data-song-map-bar]")) {
    const bar = Number(item.dataset.songMapBar);
    item.classList.toggle("is-current", bar === currentBar);
    item.classList.toggle("is-looped", state.loopEnabled && bar >= state.loopStartBar && bar <= state.loopEndBar);
  }
  const current = els.songMap.querySelector(".song-map-bar.is-current");
  if (current) {
    current.scrollIntoView({ block: "nearest", inline: "center", behavior: state.playing ? "auto" : "smooth" });
  }
}

function updatePlayerMeta() {
  if (!state.track) return;
  const effectiveBpm = Math.round((state.track.bpm || 0) * state.speed);
  els.currentSongTitle.textContent = state.track.name;
  els.currentSongBpm.textContent = `${effectiveBpm || "?"} BPM`;
  updateMidiStatus();
}

function updateMidiStatus() {
  const status = state.midiConnected ? state.midiDeviceName || "MIDI bereit" : state.midiDeviceName || "MIDI aus";
  const note = state.midiLastNote ? ` · ${state.midiLastNote}` : "";
  els.midiStatus.textContent = `${status}${note}`;
  els.midi.classList.toggle("is-connected", state.midiConnected);
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    state.midiConnected = false;
    state.midiDeviceName = "Web MIDI nicht verfügbar";
    updateMidiStatus();
    return;
  }

  try {
    state.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    state.midiAccess.onstatechange = refreshMidiInputs;
    refreshMidiInputs();
  } catch (error) {
    state.midiConnected = false;
    state.midiDeviceName = "MIDI nicht erlaubt";
    updateMidiStatus();
  }
}

function refreshMidiInputs() {
  if (!state.midiAccess) return;
  const inputs = [...state.midiAccess.inputs.values()];
  state.midiConnected = inputs.length > 0;
  state.midiDeviceName = inputs[0]?.name || "Kein MIDI-Gerät";
  for (const input of inputs) {
    input.onmidimessage = handleMidiMessage;
  }
  updateMidiStatus();
}

function handleMidiMessage(message) {
  const [status, note, velocity] = message.data;
  const command = status & 0xf0;
  if (command !== 0x90 || velocity === 0) return;

  const laneId = midiDrumMap.get(note);
  if (!laneId) {
    state.midiLastNote = `Note ${note}`;
    updateMidiStatus();
    return;
  }

  const lane = lanes.find((item) => item.id === laneId);
  state.midiLastNote = `${lane?.label || laneId} ${note}`;
  ensureAudio();
  hitLane(laneId);

  const button = els.laneButtons.find((item) => item.dataset.lane === laneId);
  button?.classList.add("pressed");
  window.setTimeout(() => button?.classList.remove("pressed"), 90);
  updateMidiStatus();
}

function setLoopBar(which, delta) {
  const maxBars = totalBars();
  if (which === "loopStart") {
    state.loopStartBar = Math.min(Math.max(1, state.loopStartBar + delta), Math.max(1, state.loopEndBar - 1));
  } else {
    state.loopEndBar = Math.min(Math.max(state.loopStartBar + 1, state.loopEndBar + delta), maxBars);
  }
  if (state.loopEnabled && currentTime() >= loopEndTime()) {
    state.pausedAt = loopStartTime();
    state.startedAt = performance.now();
  }
  updatePracticeControls();
  updateSongMap(true);
  draw();
}

function setLoopLength(delta) {
  setLoopFromCurrentBar(loopLengthBars() + delta);
  if (state.loopEnabled && (currentTime() < loopStartTime() || currentTime() >= loopEndTime())) {
    state.pausedAt = loopStartTime();
    state.startedAt = performance.now();
  }
  updatePracticeControls();
  updateSongMap(true);
  draw();
}

function setZoom(value) {
  const min = Number(els.zoom.min);
  const max = Number(els.zoom.max);
  const next = Math.min(max, Math.max(min, value));
  els.zoom.value = String(next);
  state.zoom = next / 100;
  els.zoomLabel.textContent = `${next}%`;
  if (state.track) draw();
}

function stepControl(control, delta) {
  if (control === "zoom") {
    setZoom(Number(els.zoom.value) + delta);
  } else if (control === "speed") {
    const min = Number(els.speed.min);
    const max = Number(els.speed.max);
    const next = Math.min(max, Math.max(min, Number(els.speed.value) + delta));
    els.speed.value = String(next);
    setSpeed(next / 100);
  } else if (control === "backingVolume") {
    setBackingVolume(Number(els.backingVolume.value) + delta);
  } else if (control === "hitWindow") {
    const modes = Object.keys(accuracyPresets);
    const current = modes.indexOf(state.accuracyMode);
    const next = Math.min(modes.length - 1, Math.max(0, current + Math.sign(delta)));
    setAccuracyMode(modes[next]);
  } else if (control === "loopStart" || control === "loopEnd") {
    setLoopBar(control, delta);
  } else if (control === "loopLength") {
    setLoopLength(delta);
  }
}

function createAudioContext() {
  if (!state.audio) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    state.audio = new AudioContextClass();
  }
  return state.audio;
}

async function ensureAudio() {
  const audio = createAudioContext();
  if (!audio) return null;
  if (state.audioReady) await state.audioReady;
  if (state.audio.state === "suspended") {
    try {
      await state.audio.resume();
    } catch (error) {
      state.audioUnlocked = false;
      console.warn("Audio unlock blocked", error);
      return null;
    }
  }
  await unlockAudioOutput();
  preloadSamples();
  if (!state.noiseBuffer) {
    const length = Math.floor(state.audio.sampleRate * 0.25);
    const buffer = state.audio.createBuffer(1, length, state.audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    state.noiseBuffer = buffer;
  }
  return state.audio;
}

function unlockAudioOutput() {
  if (!state.audio || state.audioUnlocked || state.audioUnlocking) return state.audioUnlocking;
  const now = state.audio.currentTime;
  const source = state.audio.createBufferSource();
  const buffer = state.audio.createBuffer(1, 1, state.audio.sampleRate);
  const gain = state.audio.createGain();
  const oscillator = state.audio.createOscillator();
  const oscillatorGain = state.audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  oscillatorGain.gain.setValueAtTime(0.0001, now);
  oscillator.frequency.setValueAtTime(440, now);
  source.buffer = buffer;
  source.connect(gain).connect(state.audio.destination);
  oscillator.connect(oscillatorGain).connect(state.audio.destination);
  source.start(now);
  source.stop(now + 0.01);
  oscillator.start(now);
  oscillator.stop(now + 0.02);
  state.audioUnlocking = new Promise((resolve) => {
    oscillator.onended = () => {
      state.audioUnlocked = true;
      state.audioUnlocking = null;
      resolve();
    };
  });
  return state.audioUnlocking;
}

function primeMobileAudio(volume = 0.00001) {
  if (!state.audio || state.muted) return;
  const now = state.audio.currentTime;
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  gain.gain.setValueAtTime(volume, now);
  osc.frequency.setValueAtTime(220, now);
  osc.connect(gain).connect(state.audio.destination);
  osc.start(now);
  osc.stop(now + 0.025);
}

function activateAudioFromGesture() {
  const audio = createAudioContext();
  if (!audio) return null;
  if (!state.audioReady) {
    state.audioReady = Promise.resolve()
      .then(() => (audio.state === "suspended" ? audio.resume() : undefined))
      .then(() => unlockAudioOutput())
      .then(() => {
        state.audioUnlocked = true;
        primeMobileAudio();
        preloadSamples();
        return audio;
      })
      .catch((error) => {
        state.audioReady = null;
        state.audioUnlocked = false;
        console.warn("Audio resume blocked", error);
        return null;
      });
  }
  if (!state.noiseBuffer) {
    const length = Math.floor(state.audio.sampleRate * 0.25);
    const buffer = state.audio.createBuffer(1, length, state.audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    state.noiseBuffer = buffer;
  }
  return state.audioReady;
}

function preventDoubleTapZoom(event) {
  const now = Date.now();
  if (now - state.lastTouchEnd < 340) {
    event.preventDefault();
  }
  state.lastTouchEnd = now;
}

function preloadSamples() {
  for (const id of Object.keys(sampleManifest)) loadSample(id);
}

function loadSample(id) {
  if (state.samples.has(id)) return Promise.resolve(state.samples.get(id));
  if (state.samplePromises.has(id)) return state.samplePromises.get(id);
  const sample = sampleManifest[id];
  if (!sample) return Promise.resolve(null);
  const promise = fetch(sample.url)
    .then((response) => {
      if (!response.ok) throw new Error(`Sample ${id} konnte nicht geladen werden`);
      return response.arrayBuffer();
    })
    .then((data) => state.audio.decodeAudioData(data))
    .then((buffer) => {
      state.samples.set(id, buffer);
      return buffer;
    })
    .catch((error) => {
      console.warn(error);
      state.samplePromises.delete(id);
      return null;
    });
  state.samplePromises.set(id, promise);
  return promise;
}

function playSample(id, volume, options = {}) {
  if (!state.audio || state.muted || volume <= 0) return false;
  const buffer = state.samples.get(id);
  if (!buffer) {
    loadSample(id);
    return false;
  }

  const now = state.audio.currentTime;
  const source = state.audio.createBufferSource();
  const gain = state.audio.createGain();
  let output = gain;

  source.buffer = buffer;
  source.playbackRate.value = options.rate || 1;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + (options.attack || 0.006));
  if (options.duration) {
    const hold = Math.max(0.035, options.duration - 0.04);
    gain.gain.setValueAtTime(volume, now + hold);
    gain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.06, options.duration));
  }

  if (options.filter) {
    const filter = state.audio.createBiquadFilter();
    filter.type = options.filter.type;
    filter.frequency.value = options.filter.frequency;
    filter.Q.value = options.filter.q || 0.8;
    source.connect(filter).connect(gain);
  } else {
    source.connect(gain);
  }

  output.connect(state.audio.destination);
  source.start(now);
  if (options.duration) {
    source.stop(now + Math.min(buffer.duration / source.playbackRate.value, options.duration + 0.03));
  }
  return true;
}

function envelope(gain, volume, seconds) {
  const now = state.audio.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
}

function playNoise(volume, seconds, filterType, frequency) {
  const source = state.audio.createBufferSource();
  const filter = state.audio.createBiquadFilter();
  const gain = state.audio.createGain();
  source.buffer = state.noiseBuffer;
  filter.type = filterType;
  filter.frequency.value = frequency;
  envelope(gain, volume, seconds);
  source.connect(filter).connect(gain).connect(state.audio.destination);
  source.start();
  source.stop(state.audio.currentTime + seconds);
}

function playOsc(type, startFrequency, endFrequency, volume, seconds) {
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  const now = state.audio.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(startFrequency, now);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, now + seconds);
  envelope(gain, volume, seconds);
  osc.connect(gain).connect(state.audio.destination);
  osc.start();
  osc.stop(now + seconds);
}

function midiFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function playBackingNote(event) {
  if (state.muted || !state.audio || state.backingVolume <= 0) return;
  const frequency = midiFrequency(event.note);
  const duration = Math.max(0.08, Math.min(1.8, (event.duration || 220) / 1000 / Math.max(0.5, state.speed)));
  const velocity = Math.max(0.18, Math.min(1, (event.velocity || 80) / 127));
  const sampleId =
    event.part === "bass" ? "bass" :
    event.part === "leadGuitar" ? "leadGuitar" :
    event.part === "rhythmGuitar" ? "rhythmGuitar" :
    "rhythmGuitar";
  const sample = sampleManifest[sampleId];
  const sampledPartVolume =
    sampleId === "bass" ? 0.22 :
    sampleId === "leadGuitar" ? 0.13 :
    0.105;
  const sampledVolume = Math.min(0.82, sampledPartVolume * state.backingVolume * velocity * generatedBackingBoost);

  if (sample) {
    const rate = midiFrequency(event.note) / midiFrequency(sample.rootNote);
    const filter =
      sampleId === "bass"
        ? { type: "lowpass", frequency: 1200, q: 0.55 }
        : { type: "highpass", frequency: sampleId === "leadGuitar" ? 450 : 320, q: 0.45 };
    if (playSample(sampleId, sampledVolume, { rate, duration, attack: sampleId === "bass" ? 0.004 : 0.002, filter })) return;
  }

  const partVolume = event.part === "bass" ? 0.032 : 0.018;
  const volume = Math.min(0.24, partVolume * state.backingVolume * velocity * generatedBackingBoost);
  const now = state.audio.currentTime;
  const osc = state.audio.createOscillator();
  const filter = state.audio.createBiquadFilter();
  const gain = state.audio.createGain();

  osc.type = event.part === "bass" ? "triangle" : "sawtooth";
  osc.frequency.setValueAtTime(frequency, now);
  if (event.part !== "bass") {
    osc.detune.setValueAtTime(event.note % 2 === 0 ? -5 : 5, now);
  }
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(event.part === "bass" ? 520 : 1550, now);
  filter.Q.setValueAtTime(event.part === "bass" ? 0.7 : 1.2, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(filter).connect(gain).connect(state.audio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playDrum(laneId, accent = 1, variant = "") {
  if (state.muted || !state.audio) return;
  const volume = 0.16 * accent;
  const sampleId =
    laneId === "hihat" ? (variant === "open" ? "hihatOpen" : "hihatClosed") :
    laneId === "pedalHat" ? "pedalHat" :
    laneId;
  const sampleVolume = volume * (
    laneId === "kick" ? 2.9 :
    laneId === "snare" ? 2.35 :
    laneId === "crash" ? 1.8 :
    laneId === "ride" ? 1.65 :
    laneId.includes("Tom") ? 2.15 :
    laneId === "pedalHat" ? 0.9 :
    1.45
  );
  const sample = sampleManifest[sampleId];
  if (playSample(sampleId, sampleVolume, { rate: sample?.rate || 1 })) return;

  if (laneId === "kick") {
    playOsc("sine", 115, 42, volume * 1.4, 0.18);
  } else if (laneId === "snare") {
    playNoise(volume, 0.12, "bandpass", 1800);
    playOsc("triangle", 190, 130, volume * 0.45, 0.08);
  } else if (laneId === "hihat" || laneId === "pedalHat") {
    const open = variant === "open";
    playNoise(volume * (open ? 0.95 : laneId === "pedalHat" ? 0.45 : 0.7), open ? 0.2 : 0.06, "highpass", open ? 4200 : 5200);
  } else if (laneId === "crash") {
    playNoise(volume, 0.35, "highpass", 3600);
  } else if (laneId === "ride") {
    playNoise(volume * 0.55, 0.12, "highpass", 4200);
    playOsc("sine", 740, 660, volume * 0.22, 0.12);
  } else if (laneId === "highTom") {
    playOsc("sine", 310, 205, volume, 0.16);
  } else if (laneId === "midTom") {
    playOsc("sine", 245, 160, volume, 0.18);
  } else if (laneId === "lowTom") {
    playOsc("sine", 180, 95, volume * 1.1, 0.22);
  }
}

function playBadHit() {
  if (state.muted || !state.audio) return;
  playOsc("sawtooth", 130, 80, 0.045, 0.08);
}

async function hitLane(laneId) {
  await ensureAudio();
  const now = currentTime();
  if (now < practiceStartTime()) return;
  const candidates = state.events
    .filter((event) => event.lane === laneId && isEventInPracticeRange(event) && !event.skipped && !event.hit && !event.missed)
    .map((event) => ({ event, delta: Math.abs(event.time - now) }))
    .sort((a, b) => a.delta - b.delta);

  state.attempts += 1;
  if (candidates.length && candidates[0].delta <= state.hitWindow) {
    const { event, delta } = candidates[0];
    const timingDelta = event.time - now;
    event.hit = true;
    state.combo += 1;
    state.hits += 1;
    const perfect = delta <= Math.max(24, state.hitWindow * 0.45);
    state.score += perfect ? 120 + state.combo * 3 : 70 + state.combo;
    const timing = timingLabel(timingDelta);
    state.judgement = `${perfect ? "Perfect" : "Good"} · ${timing}`;
    state.flash.set(laneId, { until: performance.now() + 130, good: true });
    state.hitEffects.push({ lane: laneId, started: performance.now(), perfect, timing });
    event.played = true;
    playDrum(laneId, perfect ? 1.15 : 0.95, event.variant);
  } else {
    state.combo = 0;
    state.judgement = "Miss";
    state.flash.set(laneId, { until: performance.now() + 160, good: false });
    playBadHit();
  }
  updateStats();
}

function timingLabel(delta) {
  if (Math.abs(delta) <= 10) return "On";
  return delta > 0 ? "Early" : "Late";
}

function updatePlaybackSounds() {
  if (state.muted || !state.audio) return;
  const now = currentTime();
  if (now < practiceStartTime()) return;
  for (const event of state.backingEvents) {
    if (!isEventInPracticeRange(event)) continue;
    if (!event.played && now >= event.time) {
      event.played = true;
      if (now - event.time <= 180) playBackingNote(event);
    }
    if (event.time - now > 180) break;
  }
  for (const event of state.events) {
    if (!isEventInPracticeRange(event)) continue;
    if (!event.played && now >= event.time) {
      event.played = true;
    }
    if (event.time - now > 180) break;
  }
}

function updateMisses() {
  const now = currentTime();
  if (now < practiceStartTime()) return;
  const missWindow = state.hitWindow + 20;
  for (const event of state.events) {
    if (!isEventInPracticeRange(event)) continue;
    if (!event.skipped && !event.hit && !event.missed && now - event.time > missWindow) {
      event.missed = true;
      state.combo = 0;
      state.attempts += 1;
      state.judgement = "Miss";
    }
  }
}

function updateCountIn() {
  if (!state.countIn || !state.playing || !state.audio) return;
  const now = currentTime();
  const start = practiceStartTime();
  const countStart = start - countInDuration();
  if (now < countStart || now >= start) return;
  const beat = Math.floor((now - countStart) / beatMs());
  if (beat < 0 || beat === state.countBeat) return;
  state.countBeat = beat;
  state.judgement = `Count ${beat + 1}`;
  playDrum(beat === 2 ? "snare" : "hihat", beat === 2 ? 0.78 : 0.52);
}

function updateLoop() {
  if (!state.loopEnabled || !state.playing) return;
  const now = currentTime();
  const start = loopStartTime();
  const end = loopEndTime();
  if (now < end) return;
  resetEventsInRange(start, end);
  state.pausedAt = start;
  state.startedAt = performance.now();
  state.countBeat = -1;
  state.combo = 0;
  state.judgement = "Loop";
  syncBackingAudio(true);
}

function updateStats() {
  els.score.textContent = Math.round(state.score).toLocaleString();
  els.combo.textContent = state.combo.toString();
  const acc = state.attempts === 0 ? 100 : Math.round((state.hits / state.attempts) * 100);
  els.accuracy.textContent = `${Math.max(0, acc)}%`;
  els.judgement.textContent = state.judgement;
  els.mute.classList.toggle("is-muted", state.muted);
  els.seekBack.disabled = state.playing;
  els.seekForward.disabled = state.playing;
}

function completionStats() {
  const misses = Math.max(
    state.attempts - state.hits,
    state.events.filter((event) => event.missed).length
  );
  const accuracy = state.attempts === 0 ? 100 : Math.round((state.hits / state.attempts) * 100);
  return {
    score: Math.round(state.score),
    hits: state.hits,
    misses,
    accuracy: Math.max(0, accuracy)
  };
}

function hideCompletion() {
  els.completionOverlay.classList.remove("is-visible");
  els.completionOverlay.setAttribute("aria-hidden", "true");
}

function animateNumber(element, target, suffix = "") {
  cancelAnimationFrame(state.scoreAnimation);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    element.textContent = `${target.toLocaleString()}${suffix}`;
    return;
  }
  const started = performance.now();
  const duration = 820;

  function step(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    element.textContent = `${Math.round(target * eased).toLocaleString()}${suffix}`;
    if (progress < 1) state.scoreAnimation = requestAnimationFrame(step);
  }

  state.scoreAnimation = requestAnimationFrame(step);
}

function showCompletion() {
  const stats = completionStats();
  els.completionTitle.textContent = state.track?.name || "Finished";
  els.completionHits.textContent = stats.hits.toLocaleString();
  els.completionMisses.textContent = stats.misses.toLocaleString();
  els.completionAccuracy.textContent = `${stats.accuracy}%`;
  els.completionScore.textContent = "0";
  els.completionOverlay.classList.add("is-visible");
  els.completionOverlay.setAttribute("aria-hidden", "false");
  animateNumber(els.completionScore, stats.score);
}

function finishSong(duration) {
  if (state.completed) return;
  state.completed = true;
  state.playing = false;
  state.pausedAt = duration;
  state.judgement = "Finished";
  els.play.classList.remove("is-playing");
  els.app.classList.add("is-finishing");
  stopBackingAudio(true);
  updateStats();
  clearTimeout(state.finishTimer);
  state.finishTimer = window.setTimeout(showCompletion, 760);
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(600, Math.floor(rect.width * ratio));
  els.canvas.height = Math.max(420, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function chartMetrics() {
  const width = els.canvas.clientWidth;
  const height = els.canvas.clientHeight;
  const laneAreaHeight = height;
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  return {
    width,
    height,
    laneAreaHeight,
    laneHeight: laneAreaHeight / lanes.length,
    hitX: width * (isMobile ? 0.26 : 0.32),
    pxPerMs: 0.18 * state.zoom
  };
}

function markerScale(laneHeight) {
  const zoomScale = 0.82 + (state.zoom - 0.7) * 0.34;
  const laneScale = Math.min(1, laneHeight / 56);
  return Math.max(0.62, Math.min(1.12, zoomScale * laneScale));
}

function markerSizeForChart(pxPerMs, laneHeight) {
  const compactViewport = window.matchMedia("(max-width: 760px)").matches;
  const base = (compactViewport ? 40 : 46) * markerScale(laneHeight);
  let nearest = Infinity;

  for (let i = 0; i < state.events.length; i++) {
    const event = state.events[i];
    for (let j = i + 1; j < state.events.length; j++) {
      const other = state.events[j];
      if (other.lane !== event.lane) continue;
      const distance = Math.abs(other.time - event.time) * pxPerMs;
      if (distance > 0 && distance < nearest) nearest = distance;
    }
  }

  if (nearest === Infinity) return base;
  return Math.max(compactViewport ? 24 : 28, Math.min(base, nearest * 0.72));
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function colorWithAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawNotePad(x, y, lane, laneId, missed, size, ghost = false, variant = "") {
  const colors = chartColors();
  const light = document.documentElement.dataset.theme === "light";
  const alpha = ghost ? 0.28 : missed ? 0.22 : 1;
  const scale = size / 46;
  const stroke = Math.max(1.3, 1.75 * scale);
  const pressOffset = Math.max(2.8, 4.8 * scale);
  const padShadow = missed || ghost ? 0 : 10 * scale;
  const laneGlow = colorWithAlpha(lane.color, light ? 0.24 : 0.22);

  const drawRaisedRect = (w, h, radius) => {
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = padShadow;
    ctx.shadowOffsetY = missed || ghost ? 0 : 3 * scale;
    ctx.fillStyle = colors.markerDepth;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2 + pressOffset, w, h, radius);
    ctx.fill();

    ctx.shadowColor = laneGlow;
    ctx.shadowBlur = missed || ghost ? 0 : 7 * scale;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = lane.color;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, radius);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = colors.markerEdge;
    ctx.lineWidth = stroke;
    ctx.stroke();

  };

  const drawRaisedCircle = (radius) => {
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = padShadow;
    ctx.shadowOffsetY = missed || ghost ? 0 : 3 * scale;
    ctx.fillStyle = colors.markerDepth;
    ctx.beginPath();
    ctx.arc(x, y + pressOffset, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = laneGlow;
    ctx.shadowBlur = missed || ghost ? 0 : 7 * scale;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = lane.color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = colors.markerEdge;
    ctx.lineWidth = stroke;
    ctx.stroke();
  };

  const drawRaisedDiamond = (wide, half) => {
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = padShadow;
    ctx.shadowOffsetY = missed || ghost ? 0 : 3 * scale;
    ctx.fillStyle = colors.markerDepth;
    ctx.beginPath();
    ctx.moveTo(x, y - half + pressOffset);
    ctx.lineTo(x + wide, y + pressOffset);
    ctx.lineTo(x, y + half + pressOffset);
    ctx.lineTo(x - wide, y + pressOffset);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = laneGlow;
    ctx.shadowBlur = missed || ghost ? 0 : 7 * scale;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = lane.color;
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + wide, y);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x - wide, y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = colors.markerEdge;
    ctx.lineWidth = stroke;
    ctx.stroke();
  };

  ctx.save();
  ctx.globalAlpha = alpha;
  if (ghost) ctx.filter = "saturate(0.64)";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (laneId === "crash") {
    drawRaisedDiamond(31 * scale, 22 * scale);
  } else if (laneId === "hihat") {
    const open = variant === "open";
    drawRaisedCircle(20 * scale);
    if (open) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = light ? "rgba(246,252,241,0.88)" : "rgba(4,12,10,0.72)";
      ctx.beginPath();
      ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (laneId === "ride") {
    drawRaisedRect(58 * scale, 31 * scale, 999 * scale);
  } else if (laneId === "kick" || laneId === "pedalHat") {
    drawRaisedRect(52 * scale, 31 * scale, 13 * scale);
  } else {
    drawRaisedRect(40 * scale, 40 * scale, 13 * scale);
  }

  ctx.restore();
}

function draw() {
  const colors = chartColors();
  const { width, height, laneAreaHeight, laneHeight, hitX, pxPerMs } = chartMetrics();
  const now = currentTime();
  const duration = trackDuration(state.track);
  const markerSize = markerSizeForChart(pxPerMs, laneHeight);

  ctx.clearRect(0, 0, width, height);
  const chartGradient = ctx.createLinearGradient(0, 0, width, laneAreaHeight);
  chartGradient.addColorStop(0, colors.chartA);
  chartGradient.addColorStop(0.48, colors.chartB);
  chartGradient.addColorStop(1, colors.chartC);
  ctx.fillStyle = chartGradient;
  ctx.fillRect(0, 0, width, laneAreaHeight);

  for (let i = 0; i < lanes.length; i++) {
    if (i % 2 !== 0) continue;
    ctx.fillStyle = colors.stripe;
    ctx.fillRect(0, i * laneHeight, width, laneHeight);
  }

  drawTimeGrid(width, laneAreaHeight, hitX, pxPerMs, now);
  drawLoopRegion(width, laneAreaHeight, hitX, pxPerMs, now);

  for (let i = 1; i < lanes.length; i++) {
    ctx.strokeStyle = i === 3 || i === 7 ? colors.gridMajor : colors.gridMinor;
    ctx.lineWidth = i === 7 ? 3.2 : i === 3 ? 2.8 : 1.6;
    const y = i * laneHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (const event of state.events) {
    if (event.hit) continue;
    const x = hitX + (event.time - now) * pxPerMs;
    if (x < -markerSize || x > width + markerSize) continue;
    const isPastPreview = !state.playing && event.time < now - 2;
    const ghost = isPastPreview || (state.loopEnabled && !isEventInPracticeRange(event));
    const laneIndex = lanes.findIndex((lane) => lane.id === event.lane);
    const y = laneIndex * laneHeight + laneHeight / 2;
    const lane = lanes[laneIndex];
    drawNotePad(x, y, lane, event.lane, event.missed, markerSize, ghost, event.variant);
  }

  const nowPerf = performance.now();
  for (const [laneId, flash] of state.flash) {
    if (flash.until < nowPerf) {
      state.flash.delete(laneId);
      continue;
    }
    const laneIndex = lanes.findIndex((lane) => lane.id === laneId);
    ctx.fillStyle = flash.good ? colors.goodFlash : colors.badFlash;
    ctx.fillRect(0, laneIndex * laneHeight, width, laneHeight);
  }

  drawHitEffects(hitX, laneHeight, laneAreaHeight);
  drawSeekHint(hitX, laneAreaHeight, now);

  const durationSafe = Math.max(1, trackDuration(state.track));
  const songProgress = Math.min(100, Math.max(0, (now / durationSafe) * 100));
  els.progress.style.width = `${songProgress}%`;
  const loopStartPct = Math.min(100, Math.max(0, (loopStartTime() / durationSafe) * 100));
  const loopEndPct = Math.min(100, Math.max(loopStartPct, (loopEndTime() / durationSafe) * 100));
  els.progress.parentElement.style.setProperty("--loop-start", `${loopStartPct}%`);
  els.progress.parentElement.style.setProperty("--loop-end", `${loopEndPct}%`);
  if (!state.loopEnabled && state.playing && now >= duration + 700) {
    finishSong(duration);
  }
}

function drawSeekHint(hitX, laneAreaHeight, now) {
  if (state.playing || performance.now() > state.seekHintUntil) return;
  const colors = chartColors();
  const alpha = Math.min(1, (state.seekHintUntil - performance.now()) / 240);
  const label = `Start ${formatTime(now)}`;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = "800 12px Sora, system-ui, sans-serif";
  const width = ctx.measureText(label).width + 22;
  const x = Math.max(10, hitX - width / 2);
  const y = Math.max(14, Math.min(laneAreaHeight - 38, 18));
  ctx.fillStyle = colors.labelBg;
  ctx.shadowColor = colors.shadow;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(x, y, width, 28, 14);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = colors.cue;
  ctx.fillText(label, x + 11, y + 18);
  ctx.restore();
}

function drawHitEffects(hitX, laneHeight, laneAreaHeight) {
  const colors = chartColors();
  const now = performance.now();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  state.hitEffects = state.hitEffects.filter((effect) => now - effect.started < (reduceMotion ? 120 : 430));

  for (const effect of state.hitEffects) {
    const elapsed = now - effect.started;
    const duration = reduceMotion ? 120 : effect.perfect ? 430 : 300;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const laneIndex = lanes.findIndex((lane) => lane.id === effect.lane);
    if (laneIndex < 0) continue;

    const y = laneIndex * laneHeight + laneHeight / 2;
    if (y < 0 || y > laneAreaHeight) continue;
    const lane = lanes[laneIndex];
    const radius = (effect.perfect ? 24 : 13) + eased * (effect.perfect ? 30 : 12);
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = effect.perfect ? 5 : 2;
    ctx.strokeStyle = effect.perfect ? colors.cue : lane.color;
    ctx.shadowColor = effect.perfect ? colors.cue : lane.color;
    ctx.shadowBlur = effect.perfect ? 16 : 4;
    ctx.beginPath();
    ctx.arc(hitX, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (effect.perfect) {
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = colors.cue;
      ctx.beginPath();
      ctx.arc(hitX, y, Math.max(4, 8 - eased * 3), 0, Math.PI * 2);
      ctx.fill();
    }

    if (effect.timing && effect.timing !== "On") {
      const labelX = hitX + 14;
      const labelY = y - 18 - eased * 6;
      ctx.globalAlpha = alpha * 0.86;
      ctx.shadowBlur = 0;
      ctx.font = "760 12px Sora, system-ui, sans-serif";
      const labelWidth = ctx.measureText(effect.timing).width + 12;
      ctx.fillStyle = colors.labelBg;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY - 14, labelWidth, 20, 10);
      ctx.fill();
      ctx.fillStyle = effect.timing === "Early" ? colors.early : colors.late;
      ctx.fillText(effect.timing, labelX + 6, labelY);
    }
    ctx.restore();
  }
}

function drawLoopRegion(width, laneAreaHeight, hitX, pxPerMs, now) {
  if (!state.loopEnabled) return;
  const colors = chartColors();
  const start = loopStartTime();
  const end = loopEndTime();
  const rawStartX = hitX + (start - now) * pxPerMs;
  const rawEndX = hitX + (end - now) * pxPerMs;
  const startX = Math.max(0, Math.min(width, rawStartX));
  const endX = Math.max(0, Math.min(width, rawEndX));

  if (endX > 0 && startX < width) {
    ctx.fillStyle = colors.loopFill;
    ctx.fillRect(startX, 0, Math.max(0, endX - startX), laneAreaHeight);
  }

  const marks = [
    { x: rawStartX, label: `Loop ${state.loopStartBar}` },
    { x: rawEndX, label: `Ende ${state.loopEndBar}` }
  ];

  for (const mark of marks) {
    if (mark.x < -28 || mark.x > width + 28) continue;
    ctx.strokeStyle = colors.loopLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mark.x, 0);
    ctx.lineTo(mark.x, laneAreaHeight);
    ctx.stroke();

    ctx.font = "760 12px Sora, system-ui, sans-serif";
    const labelWidth = ctx.measureText(mark.label).width + 18;
    const labelX = Math.max(8, Math.min(width - labelWidth - 8, mark.x + 8));
    ctx.fillStyle = colors.labelBg;
    ctx.beginPath();
    ctx.roundRect(labelX, 10, labelWidth, 23, 12);
    ctx.fill();
    ctx.fillStyle = colors.labelText;
    ctx.fillText(mark.label, labelX + 9, 25);
  }
}

function drawTimeGrid(width, laneAreaHeight, hitX, pxPerMs, now) {
  const colors = chartColors();
  const bpm = state.track?.bpm || 100;
  const sixteenthMs = 60000 / bpm / 4;
  const lookBehind = hitX / pxPerMs;
  const lookAhead = (width - hitX) / pxPerMs;
  const firstStep = Math.floor((now - lookBehind) / sixteenthMs) - 1;
  const lastStep = Math.ceil((now + lookAhead) / sixteenthMs) + 1;

  for (let step = firstStep; step <= lastStep; step++) {
    const time = step * sixteenthMs;
    const x = hitX + (time - now) * pxPerMs;
    if (x < -2 || x > width + 2) continue;

    const inBeat = ((step % 4) + 4) % 4 === 0;
    const inBar = ((step % 16) + 16) % 16 === 0;
    ctx.strokeStyle = inBar
      ? colors.gridMajor
      : inBeat
        ? colors.gridMinor
        : colors.gridFine;
    ctx.lineWidth = inBar ? 2.5 : inBeat ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, laneAreaHeight);
    ctx.stroke();

    if (inBar && step >= 0) {
      const barNumber = Math.floor(step / 16) + 1;
      ctx.save();
      ctx.font = "800 10px Sora, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = colors.labelText;
      ctx.globalAlpha = 0.54;
      ctx.fillText(String(barNumber), x + 5, 6);
      ctx.restore();
    }
  }
}

function tick() {
  if (state.playing) {
    updateCountIn();
    syncBackingAudio(true);
    updatePlaybackSounds();
    updateMisses();
    updateLoop();
    updateStats();
  }
  updateSongMap();
  draw();
  requestAnimationFrame(tick);
}

function init() {
  document.addEventListener("pointerdown", activateAudioFromGesture, { once: true, passive: true });
  document.addEventListener("touchstart", activateAudioFromGesture, { once: true, passive: true });
  document.addEventListener("touchend", activateAudioFromGesture, { once: true, passive: true });
  document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });
  document.addEventListener("keydown", ensureAudio, { once: true });
  els.library.addEventListener("click", openStartScreen);
  els.menu.addEventListener("click", () => setMenuOpen(true));
  els.menuClose.addEventListener("click", () => setMenuOpen(false));
  els.menuBackdrop.addEventListener("click", () => setMenuOpen(false));
  els.playSettings.addEventListener("click", () => setPlaySettingsOpen(true));
  els.playSettingsClose.addEventListener("click", () => setPlaySettingsOpen(false));
  els.playSettingsBackdrop.addEventListener("click", () => setPlaySettingsOpen(false));
  els.playSettingsLibrary.addEventListener("click", openStartScreen);
  for (const button of els.menuSectionButtons) {
    button.addEventListener("click", () => focusMenuSection(button.dataset.menuSection));
  }
  for (const audioTarget of [els.app, els.play, els.selectedSongPlay, els.canvas, ...els.laneButtons]) {
    audioTarget?.addEventListener("pointerdown", activateAudioFromGesture, { passive: true });
    audioTarget?.addEventListener("touchstart", activateAudioFromGesture, { passive: true });
  }
  els.play.addEventListener("click", togglePlay);
  els.selectedSongPlay.addEventListener("click", () => startPractice(state.selectedTrackId));
  els.themeToggle.addEventListener("click", toggleTheme);
  els.songSearch.addEventListener("input", () => {
    state.libraryQuery = els.songSearch.value;
    renderSongCards();
  });
  for (const tab of els.libraryTabs) {
    tab.addEventListener("click", () => {
      state.libraryFilter = tab.dataset.libraryFilter || "all";
      for (const item of els.libraryTabs) {
        item.classList.toggle("is-active", item === tab);
      }
      renderSongCards();
    });
  }
  els.songEditorList.addEventListener("input", (event) => {
    const input = event.target.closest("[data-edit-field]");
    if (!input) return;
    updateSongEditDraft(input.dataset.trackId, input.dataset.editField, input.value);
  });
  els.songEditorList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-song]");
    if (editButton) {
      startSongEdit(editButton.dataset.editSong);
      return;
    }
    const saveButton = event.target.closest("[data-save-song]");
    if (saveButton) {
      saveSongEdit(saveButton.dataset.saveSong);
      return;
    }
    const cancelButton = event.target.closest("[data-cancel-song]");
    if (cancelButton) {
      cancelSongEdit(cancelButton.dataset.cancelSong);
    }
  });
  els.songEditorList.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-drag-song]");
    if (!handle) return;
    state.draggedSongId = handle.dataset.dragSong;
    handle.closest(".song-editor-item")?.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.draggedSongId);
  });
  els.songEditorList.addEventListener("dragover", (event) => {
    const item = event.target.closest(".song-editor-item");
    if (!item || !state.draggedSongId || item.dataset.trackId === state.draggedSongId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    for (const row of els.songEditorList.querySelectorAll(".song-editor-item")) {
      row.classList.toggle("is-drop-target", row === item);
    }
  });
  els.songEditorList.addEventListener("dragleave", (event) => {
    const item = event.target.closest(".song-editor-item");
    if (!item || item.contains(event.relatedTarget)) return;
    item.classList.remove("is-drop-target");
  });
  els.songEditorList.addEventListener("drop", (event) => {
    const item = event.target.closest(".song-editor-item");
    if (!item) return;
    event.preventDefault();
    reorderSong(state.draggedSongId || event.dataTransfer.getData("text/plain"), item.dataset.trackId);
    state.draggedSongId = "";
  });
  els.songEditorList.addEventListener("dragend", () => {
    state.draggedSongId = "";
    for (const row of els.songEditorList.querySelectorAll(".song-editor-item")) {
      row.classList.remove("is-dragging", "is-drop-target");
    }
  });
  els.resetSongEdits.addEventListener("click", () => {
    songEdits = {};
    songOrder = tracks.map((track) => track.id);
    state.editingSongId = "";
    state.songEditDraft = null;
    persistSongSettings();
    renderSongCards();
    renderSongEditor();
    updateSelectedSongPanel();
  });
  els.restart.addEventListener("click", restart);
  els.completionReplay.addEventListener("click", replayReady);
  els.completionLibrary.addEventListener("click", openStartScreen);
  els.midi.addEventListener("click", connectMidi);
  els.mute.addEventListener("click", () => {
    state.muted = !state.muted;
    syncBackingAudio(state.playing);
    updateStats();
  });
  els.zoom.addEventListener("input", () => {
    setZoom(Number(els.zoom.value));
  });
  els.speed.addEventListener("input", () => {
    setSpeed(Number(els.speed.value) / 100);
  });
  els.backingVolume.addEventListener("input", () => {
    setBackingVolume(Number(els.backingVolume.value));
  });
  els.hitWindow.addEventListener("input", () => {
    setHitWindow(Number(els.hitWindow.value));
  });
  for (const button of els.accuracyButtons) {
    button.addEventListener("click", () => {
      setAccuracyMode(button.dataset.accuracy);
    });
  }
  els.countInToggle.addEventListener("click", () => {
    state.countIn = !state.countIn;
    state.countBeat = -1;
    updatePracticeControls();
  });
  els.loopToggle.addEventListener("click", () => {
    state.loopEnabled = !state.loopEnabled;
    if (state.loopEnabled) {
      setLoopFromCurrentBar();
      if (currentTime() < loopStartTime() || currentTime() >= loopEndTime()) {
        state.pausedAt = loopStartTime();
        state.startedAt = performance.now();
      }
    }
    updatePracticeControls();
    draw();
  });
  for (const button of els.stepButtons) {
    button.addEventListener("click", () => {
      stepControl(button.dataset.control, Number(button.dataset.delta));
    });
  }

  for (const button of els.laneButtons) {
    button.addEventListener("pointerdown", () => {
      hitLane(button.dataset.lane);
      button.classList.add("pressed");
    });
    button.addEventListener("pointerup", () => button.classList.remove("pressed"));
    button.addEventListener("pointerleave", () => button.classList.remove("pressed"));
  }

  els.canvas.addEventListener("wheel", seekByWheel, { passive: false });
  els.songMap.addEventListener("click", (event) => {
    const button = event.target.closest("[data-song-map-bar]");
    if (!button || !state.track) return;
    seekTo((Number(button.dataset.songMapBar) - 1) * barMs());
  });
  els.seekBack.addEventListener("click", (event) => {
    event.stopPropagation();
    seekByBars(-1);
  });
  els.seekForward.addEventListener("click", (event) => {
    event.stopPropagation();
    seekByBars(1);
  });
  els.canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !state.track) return;
    if (state.playing) {
      const lane = laneFromChartPointer(event);
      if (lane) hitLane(lane.id);
      return;
    }
    state.seekingWithPointer = true;
    els.canvas.setPointerCapture?.(event.pointerId);
    seekFromPointer(event);
  });
  els.canvas.addEventListener("pointermove", (event) => {
    if (!state.seekingWithPointer) return;
    seekFromPointer(event);
  });
  els.canvas.addEventListener("pointerup", (event) => {
    state.seekingWithPointer = false;
    els.canvas.releasePointerCapture?.(event.pointerId);
  });
  els.canvas.addEventListener("pointercancel", () => {
    state.seekingWithPointer = false;
  });
  els.startScreen.addEventListener("scroll", updateHeaderScrollState, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.menuOpen) {
      setMenuOpen(false);
      return;
    }
    if (event.repeat) return;
    if (event.code === "Space") event.preventDefault();
    const key = event.key.toLowerCase();
    const lane = lanes.find((item) => item.key === key || (item.id === "kick" && event.code === "Space"));
    if (!lane) return;
    hitLane(lane.id);
    const button = els.laneButtons.find((item) => item.dataset.lane === lane.id);
    button?.classList.add("pressed");
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    const lane = lanes.find((item) => item.key === key || (item.id === "kick" && event.code === "Space"));
    if (!lane) return;
    const button = els.laneButtons.find((item) => item.dataset.lane === lane.id);
    button?.classList.remove("pressed");
  });

  window.addEventListener("resize", resizeCanvas);
  setZoom(Number(els.zoom.value));
  applyTheme(storedTheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  setSpeed(Number(els.speed.value) / 100);
  setBackingVolume(Number(els.backingVolume.value));
  setAccuracyMode(state.accuracyMode);
  setTrack(state.selectedTrackId);
  updatePracticeControls();
  updateMidiStatus();
  updateSelectedSongPanel();
  renderSongCards();
  renderSongEditor();
  updateHeaderScrollState();
  resizeCanvas();
  tick();
}

init();
