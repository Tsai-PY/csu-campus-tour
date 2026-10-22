/**
 * 正修科技大學 校園導覽巡航與語音解說系統 (Tour Manager)
 */

class CampusTourManager {
  constructor(scene, data, onStepChange, onTourEnd) {
    this.scene = scene;
    this.data = data;
    this.onStepChange = onStepChange;
    this.onTourEnd = onTourEnd;

    this.currentRoute = null;
    this.currentStopIndex = -1;
    this.isPlaying = false;
    this.isMuted = false;
    this.timer = null;
    this.speechUtterance = null;
    this.autoAdvanceDelay = 9000; // 每個景點停留 9 秒或解說完後前進
  }

  startRoute(routeId) {
    const route = this.data.tourRoutes.find(r => r.id === routeId);
    if (!route) {
      console.error("找不到導覽路線:", routeId);
      return;
    }

    this.stop(); // 停止目前所有導覽
    this.currentRoute = route;
    this.currentStopIndex = 0;
    this.isPlaying = true;

    this.executeCurrentStep();
  }

  startCustomRoute(buildingIds, title = "自訂校園巡航路線") {
    this.stop();
    this.currentRoute = {
      id: "custom",
      title: title,
      stops: buildingIds
    };
    this.currentStopIndex = 0;
    this.isPlaying = true;
    this.executeCurrentStep();
  }

  executeCurrentStep() {
    if (!this.currentRoute || this.currentStopIndex >= this.currentRoute.stops.length) {
      this.finish();
      return;
    }

    const bId = this.currentRoute.stops[this.currentStopIndex];
    const building = this.data.buildings.find(b => b.id === bId);
    if (!building) return;

    // 1. 移動 3D 相機聚焦建築物
    this.scene.flyToBuilding(bId, 1600);

    // 2. 語音解說朗讀
    this.speak(building.audioText);

    // 3. 通知 UI 更新進度與字幕
    if (this.onStepChange) {
      this.onStepChange({
        route: this.currentRoute,
        index: this.currentStopIndex,
        total: this.currentRoute.stops.length,
        building: building
      });
    }

    // 4. 設定自動前進下一站定時器 (如果沒有播放語音或語音結束時)
    clearTimeout(this.timer);
    if (this.isPlaying) {
      this.timer = setTimeout(() => {
        if (this.isPlaying) {
          this.next();
        }
      }, this.autoAdvanceDelay);
    }
  }

  next() {
    clearTimeout(this.timer);
    this.stopSpeech();
    if (this.currentRoute && this.currentStopIndex < this.currentRoute.stops.length - 1) {
      this.currentStopIndex++;
      this.executeCurrentStep();
    } else {
      this.finish();
    }
  }

  prev() {
    clearTimeout(this.timer);
    this.stopSpeech();
    if (this.currentRoute && this.currentStopIndex > 0) {
      this.currentStopIndex--;
      this.executeCurrentStep();
    }
  }

  togglePlayPause() {
    if (!this.currentRoute) return;
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.executeCurrentStep();
    } else {
      clearTimeout(this.timer);
      this.stopSpeech();
    }
    return this.isPlaying;
  }

  pause() {
    this.isPlaying = false;
    clearTimeout(this.timer);
    this.stopSpeech();
  }

  resume() {
    if (this.currentRoute) {
      this.isPlaying = true;
      this.executeCurrentStep();
    }
  }

  stop() {
    this.isPlaying = false;
    this.currentRoute = null;
    this.currentStopIndex = -1;
    clearTimeout(this.timer);
    this.stopSpeech();
    if (this.onTourEnd) {
      this.onTourEnd();
    }
  }

  finish() {
    this.stop();
  }

  // Web Speech API 中文語音導覽
  speak(text) {
    if (this.isMuted || !("speechSynthesis" in window)) return;
    this.stopSpeech();

    try {
      this.speechUtterance = new SpeechSynthesisUtterance(text);
      this.speechUtterance.lang = "zh-TW";
      this.speechUtterance.rate = 1.05;
      this.speechUtterance.pitch = 1.0;

      // 嘗試選取優質中文語音 (如 Microsoft/Google/Taiwanese Chinese)
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang === "zh-TW" || v.lang === "zh-HK" || v.lang.startsWith("zh"));
      if (zhVoice) {
        this.speechUtterance.voice = zhVoice;
      }

      window.speechSynthesis.speak(this.speechUtterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }

  stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSpeech();
    } else if (this.isPlaying && this.currentRoute) {
      const bId = this.currentRoute.stops[this.currentStopIndex];
      const building = this.data.buildings.find(b => b.id === bId);
      if (building) this.speak(building.audioText);
    }
    return this.isMuted;
  }
}
