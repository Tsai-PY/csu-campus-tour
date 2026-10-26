/**
 * 正修科技大學 3D 模擬校園導覽系統 - 主應用控制器
 */

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("webgl-container");

  // 1. 初始化 3D 校園場景
  const scene = new CampusScene(container, CAMPUS_DATA, (building) => {
    showBuildingDetail(building);
  });

  // 2. 初始化路徑搜尋器與導覽管理器
  const pathfinder = new CampusPathfinder(CAMPUS_DATA);
  const tourManager = new CampusTourManager(
    scene,
    CAMPUS_DATA,
    // 每站更新回調
    (stepInfo) => {
      updateTourHUD(stepInfo);
    },
    // 導覽結束回調
    () => {
      hideTourHUD();
    }
  );

  // 3. UI 元素
  const searchInput = document.getElementById("search-input");
  const categoryContainer = document.getElementById("category-tags");
  const buildingList = document.getElementById("building-list");
  const sidebarToggleBtn = document.getElementById("sidebar-toggle");
  const leftSidebar = document.getElementById("left-sidebar");

  const detailModal = document.getElementById("building-detail-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalBadge = document.getElementById("modal-badge");
  const modalTitle = document.getElementById("modal-title");
  const modalEnTitle = document.getElementById("modal-entitle");
  const modalSummary = document.getElementById("modal-summary");
  const modalDepts = document.getElementById("modal-depts");
  const modalFacilities = document.getElementById("modal-facilities");
  const modalAudioBtn = document.getElementById("modal-audio-btn");
  const modalSetStartBtn = document.getElementById("modal-set-start");
  const modalSetEndBtn = document.getElementById("modal-set-end");
  const modalFocusBtn = document.getElementById("modal-focus-btn");

  const tourHud = document.getElementById("tour-hud");
  const tourHudTitle = document.getElementById("tour-hud-title");
  const tourHudProgress = document.getElementById("tour-hud-progress");
  const tourSubtitles = document.getElementById("tour-subtitles");
  const tourPrevBtn = document.getElementById("tour-prev-btn");
  const tourPlayPauseBtn = document.getElementById("tour-play-pause-btn");
  const tourNextBtn = document.getElementById("tour-next-btn");
  const tourMuteBtn = document.getElementById("tour-mute-btn");
  const tourExitBtn = document.getElementById("tour-exit-btn");

  const navStartSelect = document.getElementById("nav-start-select");
  const navEndSelect = document.getElementById("nav-end-select");
  const navSwapBtn = document.getElementById("nav-swap-btn");
  const navCalculateBtn = document.getElementById("nav-calculate-btn");
  const navClearBtn = document.getElementById("nav-clear-btn");
  const navResultBox = document.getElementById("nav-result-box");
  const navDistanceVal = document.getElementById("nav-distance-val");
  const navTimeVal = document.getElementById("nav-time-val");

  const minimapBox = document.getElementById("minimap-box");
  const mapLightbox = document.getElementById("map-lightbox");
  const lightboxCloseBtn = document.getElementById("lightbox-close-btn");

  let currentCategory = "all";
  let activeBuilding = null;

  // 4. 側邊欄分類標籤定義
  const categories = [
    { key: "all", label: "全部建築" },
    { key: "admin", label: "行政中樞" },
    { key: "academic", label: "教學館舍" },
    { key: "research", label: "國家科研" },
    { key: "creative", label: "設計創意" },
    { key: "life", label: "生活餐飲" },
    { key: "sports", label: "運動休閒" },
    { key: "parking", label: "生活停車" },
    { key: "gate", label: "校門地標" }
  ];

  function renderCategoryTags() {
    categoryContainer.innerHTML = "";
    categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = `tag-btn ${cat.key === currentCategory ? "active" : ""}`;
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        currentCategory = cat.key;
        renderCategoryTags();
        renderBuildingList();
      });
      categoryContainer.appendChild(btn);
    });
  }

  // 5. 渲染左側建築物清單
  function renderBuildingList() {
    buildingList.innerHTML = "";
    const keyword = searchInput.value.trim().toLowerCase();

    const filtered = CAMPUS_DATA.buildings.filter(b => {
      const matchCat = currentCategory === "all" || b.category === currentCategory;
      const matchKeyword = !keyword ||
        b.name.toLowerCase().includes(keyword) ||
        b.number.includes(keyword) ||
        b.enName.toLowerCase().includes(keyword) ||
        b.tags.some(t => t.toLowerCase().includes(keyword)) ||
        (b.departments && b.departments.some(d => d.toLowerCase().includes(keyword)));
      return matchCat && matchKeyword;
    });

    if (filtered.length === 0) {
      buildingList.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">無相符之校園景點</div>`;
      return;
    }

    filtered.forEach(b => {
      const card = document.createElement("div");
      card.className = `building-card ${activeBuilding && activeBuilding.id === b.id ? "active" : ""}`;
      const badgeBg = b.hasAED ? '#ef4444' : '#0284c7';
      const aedIcon = b.hasAED ? ' <span style="color:#ef4444; font-size:10px; font-weight:bold;">♥AED</span>' : '';
      card.innerHTML = `
        <div class="b-badge" style="background:${badgeBg}">${b.number}</div>
        <div class="b-info">
          <div class="b-title">${b.name}${aedIcon}</div>
          <div class="b-subtitle">${b.enName} · ${b.categoryName}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        scene.flyToBuilding(b.id);
        showBuildingDetail(b);
      });

      buildingList.appendChild(card);
    });
  }

  // 6. 搜尋框監聽
  searchInput.addEventListener("input", () => {
    renderBuildingList();
  });

  // 7. 側邊欄收折
  sidebarToggleBtn.addEventListener("click", () => {
    leftSidebar.classList.toggle("collapsed");
    sidebarToggleBtn.textContent = leftSidebar.classList.contains("collapsed") ? "▶" : "◀";
  });

  // 8. 顯示建築詳細彈出資訊卡
  function showBuildingDetail(building) {
    if (!building) return;
    activeBuilding = building;

    modalBadge.textContent = building.number;
    modalTitle.textContent = building.name;
    modalEnTitle.textContent = `${building.enName} · ${building.categoryName}`;
    modalSummary.textContent = building.summary;

    // 實景照片展示區塊
    let photoBox = document.getElementById("modal-photo-preview");
    if (!photoBox) {
      photoBox = document.createElement("div");
      photoBox.id = "modal-photo-preview";
      photoBox.style.cssText = "margin: 12px 0; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.4); cursor: pointer;";
      modalSummary.parentNode.insertBefore(photoBox, modalSummary);
    }
    if (building.photo) {
      photoBox.style.display = "block";
      photoBox.innerHTML = `
        <img src="${building.photo}" alt="${building.name}" style="width:100%; height:180px; object-fit:cover; display:block;" title="點擊在新視窗檢視高清大圖">
        <div style="background:rgba(15,23,42,0.88); padding:6px 10px; font-size:11px; color:#38bdf8; display:flex; justify-content:space-between; align-items:center;">
          <span>📷 實景正面照片（正修土木工學館 · 超人力霸王立像）</span>
          <span style="color:#94a3b8; font-size:10px;">點擊放大 ↗</span>
        </div>
      `;
      photoBox.onclick = () => window.open(building.photo, "_blank");
    } else {
      photoBox.style.display = "none";
    }

    // 系所與行政單位標籤
    modalDepts.innerHTML = "";
    if (building.departments && building.departments.length > 0) {
      building.departments.forEach(dept => {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = dept;
        modalDepts.appendChild(pill);
      });
    } else {
      modalDepts.innerHTML = `<span style="font-size:11px; color:#94a3b8;">無特定系所單位</span>`;
    }

    // 設施標籤
    modalFacilities.innerHTML = "";
    if (building.hasAED) {
      const aedPill = document.createElement("span");
      aedPill.className = "pill";
      aedPill.style.background = "rgba(239, 68, 68, 0.25)";
      aedPill.style.borderColor = "#ef4444";
      aedPill.style.color = "#fca5a5";
      aedPill.style.fontWeight = "bold";
      aedPill.textContent = "♥ 設有 AED 急救站";
      modalFacilities.appendChild(aedPill);
    }
    if (building.hasCampusSafety) {
      const safetyPill = document.createElement("span");
      safetyPill.className = "pill";
      safetyPill.style.background = "rgba(249, 115, 22, 0.25)";
      safetyPill.style.borderColor = "#f97316";
      safetyPill.style.color = "#fdba74";
      safetyPill.style.fontWeight = "bold";
      safetyPill.textContent = "🛡️ 24小時校安中心 (S標章)";
      modalFacilities.appendChild(safetyPill);
    }
    if (building.facilities && building.facilities.length > 0) {
      building.facilities.forEach(fac => {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.style.background = "rgba(2, 132, 199, 0.2)";
        pill.style.borderColor = "rgba(56, 189, 248, 0.4)";
        pill.textContent = fac;
        modalFacilities.appendChild(pill);
      });
    } else {
      modalFacilities.innerHTML = `<span style="font-size:11px; color:#94a3b8;">無特殊登記設施</span>`;
    }

    detailModal.style.display = "block";
    renderBuildingList(); // 更新清單選取高亮
  }

  modalCloseBtn.addEventListener("click", () => {
    detailModal.style.display = "none";
    activeBuilding = null;
    renderBuildingList();
  });

  // 語音朗讀此棟建築解說
  modalAudioBtn.addEventListener("click", () => {
    if (activeBuilding) {
      tourManager.speak(activeBuilding.audioText);
    }
  });

  modalFocusBtn.addEventListener("click", () => {
    if (activeBuilding) {
      scene.flyToBuilding(activeBuilding.id);
    }
  });

  modalSetStartBtn.addEventListener("click", () => {
    if (activeBuilding) {
      navStartSelect.value = activeBuilding.id;
      // 切換右側分頁至導航頁
      document.querySelector('[data-tab="nav"]').click();
    }
  });

  modalSetEndBtn.addEventListener("click", () => {
    if (activeBuilding) {
      navEndSelect.value = activeBuilding.id;
      document.querySelector('[data-tab="nav"]').click();
    }
  });

  // 9. 視角預設切換
  document.querySelectorAll(".view-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      scene.setPresetView(view);
    });
  });

  // 10. 白天 / 夕陽 / 夜晚模式切換
  document.querySelectorAll(".time-mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".time-mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode;
      scene.setTimeMode(mode);
    });
  });

  // 11. 右側面板分頁切換 (主題導覽 / 路徑規劃)
  document.querySelectorAll(".panel-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".panel-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById(`tab-${target}`).classList.add("active");
    });
  });

  // 12. 渲染推薦導覽主題路線
  const routesContainer = document.getElementById("routes-list");
  CAMPUS_DATA.tourRoutes.forEach(route => {
    const card = document.createElement("div");
    card.className = "route-card";
    const stopNames = route.stops.map(id => {
      const b = CAMPUS_DATA.buildings.find(item => item.id === id);
      return b ? b.name : id;
    }).join(" ➔ ");

    card.innerHTML = `
      <div class="route-header">
        <div class="route-title">${route.title}</div>
      </div>
      <div class="route-desc">${route.desc}</div>
      <div class="route-stops-preview">📍 行經景點 (${route.stops.length} 站):<br>${stopNames}</div>
      <button class="route-start-btn">🚀 開始主題導覽巡航</button>
    `;

    card.querySelector(".route-start-btn").addEventListener("click", () => {
      tourManager.startRoute(route.id);
    });

    routesContainer.appendChild(card);
  });

  // 全校景點一鍵大巡航按鈕
  document.getElementById("start-full-tour-btn").addEventListener("click", () => {
    const allIds = CAMPUS_DATA.buildings.map(b => b.id);
    tourManager.startCustomRoute(allIds, "正修科大全校 24 大景點巡航");
  });

  // 13. 底部導覽 HUD 控制
  function updateTourHUD(stepInfo) {
    tourHud.style.display = "flex";
    tourHudTitle.textContent = `${stepInfo.route.title}`;
    tourHudProgress.textContent = `第 ${stepInfo.index + 1} / ${stepInfo.total} 站：${stepInfo.building.number} ${stepInfo.building.name}`;
    tourSubtitles.textContent = stepInfo.building.audioText;
    tourPlayPauseBtn.textContent = "⏸ 暫停";
  }

  function hideTourHUD() {
    tourHud.style.display = "none";
  }

  tourPrevBtn.addEventListener("click", () => tourManager.prev());
  tourNextBtn.addEventListener("click", () => tourManager.next());
  tourPlayPauseBtn.addEventListener("click", () => {
    const isPlaying = tourManager.togglePlayPause();
    tourPlayPauseBtn.textContent = isPlaying ? "⏸ 暫停" : "▶ 繼續";
  });
  tourMuteBtn.addEventListener("click", () => {
    const isMuted = tourManager.toggleMute();
    tourMuteBtn.textContent = isMuted ? "🔇 靜音中" : "🔊 語音";
  });
  tourExitBtn.addEventListener("click", () => tourManager.stop());

  // 14. 填充兩點導航起訖選單
  CAMPUS_DATA.buildings.forEach(b => {
    const optStart = document.createElement("option");
    optStart.value = b.id;
    optStart.textContent = `${b.number} ${b.name}`;
    navStartSelect.appendChild(optStart);

    const optEnd = document.createElement("option");
    optEnd.value = b.id;
    optEnd.textContent = `${b.number} ${b.name}`;
    navEndSelect.appendChild(optEnd);
  });

  navStartSelect.value = "b01"; // 預設正門
  navEndSelect.value = "b15";   // 預設圖書館

  navSwapBtn.addEventListener("click", () => {
    const temp = navStartSelect.value;
    navStartSelect.value = navEndSelect.value;
    navEndSelect.value = temp;
  });

  // 計算並繪製步行路徑
  navCalculateBtn.addEventListener("click", () => {
    const fromId = navStartSelect.value;
    const toId = navEndSelect.value;

    if (fromId === toId) {
      alert("起點與終點相同，請選擇不同的校園景點！");
      return;
    }

    const result = pathfinder.findPathBetweenBuildings(fromId, toId);
    if (!result) {
      alert("抱歉，目前路網暫無連通路線。");
      return;
    }

    // 1. 繪製 3D 發光光帶
    scene.drawNavigationPath(result.points);

    // 2. 顯示距離與時間
    navDistanceVal.textContent = `${result.distanceMeters} 公尺`;
    navTimeVal.textContent = `約 ${result.walkingMinutes} 分鐘`;
    navResultBox.style.display = "block";

    // 3. 視角調整至包含兩建築的廣角
    const b1 = CAMPUS_DATA.buildings.find(b => b.id === fromId);
    const b2 = CAMPUS_DATA.buildings.find(b => b.id === toId);
    const midX = (b1.pos[0] + b2.pos[0]) / 2;
    const midZ = (b1.pos[2] + b2.pos[2]) / 2;
    scene.animateCamera(new THREE.Vector3(midX - 30, 90, midZ + 110), new THREE.Vector3(midX, 5, midZ), 1200);
  });

  navClearBtn.addEventListener("click", () => {
    scene.clearNavigationPath();
    navResultBox.style.display = "none";
  });

  // 15. 原圖地圖燈箱 (Full Map Lightbox)
  minimapBox.addEventListener("click", () => {
    mapLightbox.classList.add("open");
  });
  document.getElementById("open-original-map-btn").addEventListener("click", () => {
    mapLightbox.classList.add("open");
  });
  lightboxCloseBtn.addEventListener("click", () => {
    mapLightbox.classList.remove("open");
  });

  // 16. 校園第一人稱貼地行走模式控制
  const walkHud = document.getElementById("walk-hud");
  const openWalkModeBtn = document.getElementById("open-walk-mode-btn");
  const startWalkTourBtn = document.getElementById("start-walk-tour-btn");
  const exitWalkBtn = document.getElementById("exit-walk-btn");
  const toggleAutoWalkBtn = document.getElementById("toggle-autowalk-btn");
  const toggleRunBtn = document.getElementById("toggle-run-btn");
  const walkSpotBtns = document.querySelectorAll(".walk-spot-btn");

  const dpadUp = document.getElementById("dpad-up");
  const dpadDown = document.getElementById("dpad-down");
  const dpadLeft = document.getElementById("dpad-left");
  const dpadRight = document.getElementById("dpad-right");

  // 監聽行走狀態切換
  scene.onWalkingModeChange = (isWalking, coords) => {
    if (isWalking) {
      walkHud.style.display = "flex";
      document.querySelectorAll(".view-preset-btn").forEach(b => b.classList.remove("active"));
      openWalkModeBtn.classList.add("active");
    } else {
      walkHud.style.display = "none";
      openWalkModeBtn.classList.remove("active");
    }
  };

  // 啟動與退出行走模式按鈕
  if (openWalkModeBtn) {
    openWalkModeBtn.addEventListener("click", () => {
      scene.toggleWalkingMode();
    });
  }

  if (startWalkTourBtn) {
    startWalkTourBtn.addEventListener("click", () => {
      scene.enterWalkingMode();
    });
  }

  if (exitWalkBtn) {
    exitWalkBtn.addEventListener("click", () => {
      scene.exitWalkingMode();
    });
  }

  // 自動漫遊巡視按鈕
  if (toggleAutoWalkBtn) {
    toggleAutoWalkBtn.addEventListener("click", () => {
      const isAuto = scene.toggleAutoWalk();
      toggleAutoWalkBtn.textContent = isAuto ? "⏸ 暫停自動漫步" : "🐾 自動貼地導覽散步";
      toggleAutoWalkBtn.style.background = isAuto ? "#10b981" : "#0284c7";
    });
  }

  // 跑步/步行速度切換
  if (toggleRunBtn) {
    toggleRunBtn.addEventListener("click", () => {
      scene.isRunning = !scene.isRunning;
      toggleRunBtn.textContent = scene.isRunning ? "🚶 切換步行" : "🏃 跑步模式";
      toggleRunBtn.style.background = scene.isRunning ? "#ef4444" : "rgba(51, 65, 85, 0.7)";
    });
  }

  // 快捷出發點切換
  walkSpotBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      walkSpotBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const coords = btn.dataset.coords.split(",").map(Number);
      scene.enterWalkingMode(coords);
    });
  });

  // 螢幕虛擬方向鍵事件綁定 (支援滑鼠點擊與觸控)
  function bindDpad(element, keyName) {
    if (!element) return;
    const startHandler = (e) => {
      e.preventDefault();
      element.classList.add("active");
      scene.setWalkingKey(keyName, true);
    };
    const endHandler = (e) => {
      e.preventDefault();
      element.classList.remove("active");
      scene.setWalkingKey(keyName, false);
    };

    element.addEventListener("mousedown", startHandler);
    element.addEventListener("mouseup", endHandler);
    element.addEventListener("mouseleave", endHandler);
    element.addEventListener("touchstart", startHandler, { passive: false });
    element.addEventListener("touchend", endHandler, { passive: false });
  }

  bindDpad(dpadUp, "forward");
  bindDpad(dpadDown, "backward");
  bindDpad(dpadLeft, "turnLeft");
  bindDpad(dpadRight, "turnRight");

  // 初始化首次清單渲染
  renderCategoryTags();
  renderBuildingList();
});
