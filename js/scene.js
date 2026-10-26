/**
 * 正修科技大學 3D 模擬校園場景 (Three.js)
 * 嚴格參照最新官方「校園安全地圖」重新建構道路、地形與全部建築
 */

class CampusScene {
  constructor(container, data, onSelectBuilding) {
    this.container = container;
    this.data = data;
    this.onSelectBuilding = onSelectBuilding;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.buildingMeshes = new Map(); // id -> Group
    this.buildingPins = new Map();   // id -> Sprite
    this.clickableObjects = [];
    this.hoveredBuilding = null;
    this.selectedBuilding = null;

    this.lights = {};
    this.nightObjects = []; // 燈光、發光窗戶、夜間加強照明走廊
    this.emergencyBeacons = []; // 13處緊急求助鈴閃爍燈
    this.waterMesh = null;
    this.navigationPathMesh = null;
    this.nightLightingLinesGroup = null;
    this.pathCurve = null;
    this.pathAnimOffset = 0;

    this.timeMode = "day"; // 'day' | 'sunset' | 'night'
    this.cameraAnim = null;
    this.clock = new THREE.Clock();

    // 貼地行走模式狀態
    this.isWalkingMode = false;
    this.onWalkingModeChange = null;

    this.init();
    this.initWalkingMode();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. 場景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbbf2f6);
    this.scene.fog = new THREE.FogExp2(0xbbf2f6, 0.0015);

    // 2. 相機 (正修科大斜俯瞰視角，對準校園中樞)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1600);
    this.camera.position.set(-60, 220, 280);

    // 3. 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. 控制器
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 750;
    this.controls.target.set(30, 0, 10);

    // 5. 燈光與環境
    this.setupLighting();

    // 6. 建立符合新安全地圖的地形、道路、操場田徑跑道、停車場
    this.buildTerrain();
    this.buildRoadsAndPaths();
    this.buildSportsCourtsAndTrack();
    this.buildEnvironmentAndLandmarks();

    // 7. 建立符合新地圖的 25 座建築群 (包含 20 天橋、14 機電工廠)
    this.buildBuildings();

    // 8. 建立 3D 浮動編號地標圖標與 AED 安全標記
    this.buildBuildingPins();

    // 9. 建立夜間加強照明走廊與 13 處緊急求助鈴標記
    this.buildSafetyFacilities();

    // 10. 事件綁定
    this.bindEvents();

    // 11. 循環渲染
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);
    this.lights.ambient = ambientLight;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.5);
    hemiLight.position.set(0, 200, 0);
    this.scene.add(hemiLight);
    this.lights.hemi = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.3);
    sunLight.position.set(-140, 260, 200);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 850;
    const d = 320;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);
    this.lights.sun = sunLight;
  }

  buildTerrain() {
    // 大地基座
    const groundGeo = new THREE.PlaneGeometry(1400, 1400);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe2eed3, // 清新草地溫潤綠色
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 校園核心基地底板 (地圖輪廓，微抬高展現主校區立體感)
    const campusBaseGeo = new THREE.BoxGeometry(480, 1, 420);
    const campusBaseMat = new THREE.MeshStandardMaterial({
      color: 0x86efac, // 活力草綠
      roughness: 0.8
    });
    const campusBase = new THREE.Mesh(campusBaseGeo, campusBaseMat);
    campusBase.position.set(30, -0.5, 0);
    campusBase.receiveShadow = true;
    this.scene.add(campusBase);

    // 澄清湖水域 (大埤路以西)
    const lakeGeo = new THREE.PlaneGeometry(280, 280, 32, 32);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.85
    });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-270, 0.1, 20);
    lake.receiveShadow = true;
    this.scene.add(lake);
    this.waterMesh = lake;

    // 長庚醫院專用停車場區塊 (正修路北側)
    const cghParkingGeo = new THREE.BoxGeometry(60, 0.3, 40);
    const cghParkingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const cghParking = new THREE.Mesh(cghParkingGeo, cghParkingMat);
    cghParking.position.set(-30, 0.1, -65);
    cghParking.receiveShadow = true;
    this.scene.add(cghParking);
  }

  buildRoadsAndPaths() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // 柏油路深灰
      roughness: 0.85
    });

    const walkwayMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // 人行步道淺灰色
      roughness: 0.7
    });

    // 1. 澄清路 (地圖底部的水平大道)
    const chengqingRdGeo = new THREE.PlaneGeometry(520, 26);
    const chengqingRd = new THREE.Mesh(chengqingRdGeo, roadMat);
    chengqingRd.rotation.x = -Math.PI / 2;
    chengqingRd.position.set(20, 0.05, 160);
    chengqingRd.receiveShadow = true;
    this.scene.add(chengqingRd);

    // 澄清路中央分隔白虛線
    for (let x = -220; x <= 260; x += 18) {
      const stripeGeo = new THREE.PlaneGeometry(8, 1.2);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.08, 160);
      this.scene.add(stripe);
    }

    // 正門前斑馬線 (斑馬線垂直於澄清路)
    const zebraGeo = new THREE.PlaneGeometry(2.2, 16);
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -12; i <= 12; i += 3.5) {
      const zbar = new THREE.Mesh(zebraGeo, zebraMat);
      zbar.rotation.x = -Math.PI / 2;
      zbar.position.set(-50 + i, 0.08, 160);
      this.scene.add(zbar);
    }

    // 2. 大埤路 (地圖左側縱向大道，通往澄清湖)
    const dapiRdGeo = new THREE.PlaneGeometry(24, 280);
    const dapiRd = new THREE.Mesh(dapiRdGeo, roadMat);
    dapiRd.rotation.x = -Math.PI / 2;
    dapiRd.position.set(-175, 0.05, 30);
    dapiRd.receiveShadow = true;
    this.scene.add(dapiRd);

    // 3. 正修路 (穿過校園中段的斜向主要幹道)
    const zhengxiuRdGeo = new THREE.PlaneGeometry(20, 360);
    const zhengxiuRd = new THREE.Mesh(zhengxiuRdGeo, roadMat);
    zhengxiuRd.rotation.x = -Math.PI / 2;
    zhengxiuRd.rotation.z = -Math.PI / 4.5; // 斜切貫穿校園
    zhengxiuRd.position.set(10, 0.06, -70);
    zhengxiuRd.receiveShadow = true;
    this.scene.add(zhengxiuRd);

    // 4. 濱山街 (右上角道路)
    const binshanStGeo = new THREE.PlaneGeometry(22, 180);
    const binshanSt = new THREE.Mesh(binshanStGeo, roadMat);
    binshanSt.rotation.x = -Math.PI / 2;
    binshanSt.rotation.z = -Math.PI / 3.8;
    binshanSt.position.set(170, 0.05, -170);
    this.scene.add(binshanSt);

    // 5. 正門中軸迎賓大道 (正門 -> 綜合大樓)
    const mainAvenueGeo = new THREE.PlaneGeometry(20, 35);
    const mainAvenue = new THREE.Mesh(mainAvenueGeo, walkwayMat);
    mainAvenue.rotation.x = -Math.PI / 2;
    mainAvenue.position.set(-50, 0.06, 125);
    this.scene.add(mainAvenue);

    // 6. 中央停車場 [P] (介於 10工管館、27生活創意、29產學大樓之間)
    const centerParkingGeo = new THREE.BoxGeometry(40, 0.3, 36);
    const centerParkingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
    const centerParking = new THREE.Mesh(centerParkingGeo, centerParkingMat);
    centerParking.position.set(145, 0.1, 65);
    centerParking.receiveShadow = true;
    this.scene.add(centerParking);

    // 中央停車格標線與停放小車
    for (let c = -14; c <= 14; c += 7) {
      const pLine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      pLine.rotation.x = -Math.PI / 2;
      pLine.position.set(145 + c, 0.28, 65);
      this.scene.add(pLine);

      // 小汽車
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1.4, 4.5),
        new THREE.MeshStandardMaterial({ color: [0xef4444, 0x3b82f6, 0xf8fafc, 0x10b981][Math.abs(c) % 4] })
      );
      car.position.set(145 + c, 1, 65);
      car.castShadow = true;
      this.scene.add(car);
    }
  }

  buildSportsCourtsAndTrack() {
    // 4 體育室外圍田徑跑道 (紅色PU材質環繞)
    const trackGroup = new THREE.Group();
    trackGroup.position.set(-50, 0.08, 50);

    const trackOuterGeo = new THREE.RingGeometry(24, 30, 32);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
    const trackRing = new THREE.Mesh(trackOuterGeo, trackMat);
    trackRing.rotation.x = -Math.PI / 2;
    trackGroup.add(trackRing);

    // 內場草坪
    const infield = new THREE.Mesh(
      new THREE.CircleGeometry(24, 32),
      new THREE.MeshStandardMaterial({ color: 0x22c55e })
    );
    infield.rotation.x = -Math.PI / 2;
    infield.position.y = -0.01;
    trackGroup.add(infield);

    this.scene.add(trackGroup);

    // 21 籃球場、網球場 (位於 22幼保館北側，介於幼保與25側門之間)
    const courtGroup = new THREE.Group();
    courtGroup.position.set(52, 0.1, -8);

    // 球場雙色專業鋪面
    const courtBaseGeo = new THREE.BoxGeometry(34, 0.3, 26);
    const courtBaseMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });
    const courtBase = new THREE.Mesh(courtBaseGeo, courtBaseMat);
    courtBase.receiveShadow = true;
    courtGroup.add(courtBase);

    // 綠色內場區域 (兩面標準籃球場)
    [-8, 8].forEach(cx => {
      const bbField = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 22),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      bbField.rotation.x = -Math.PI / 2;
      bbField.position.set(cx, 0.18, 0);
      courtGroup.add(bbField);

      // 三分線圈與中圈
      const circle = new THREE.Mesh(
        new THREE.RingGeometry(2.0, 2.3, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      circle.rotation.x = -Math.PI / 2;
      circle.position.set(cx, 0.2, 0);
      courtGroup.add(circle);

      // 籃球架
      [-7, 7].forEach((bx, bIdx) => {
        const hoopPost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 4.0, 8),
          new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        hoopPost.position.set(cx, 2.0, bx);

        const board = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1.4, 0.2),
          new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        board.position.set(cx, 3.4, bx + (bIdx === 0 ? 0.5 : -0.5));

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.45, 0.05, 8, 16),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(cx, 3.1, bx + (bIdx === 0 ? 0.9 : -0.9));

        courtGroup.add(hoopPost, board, ring);
      });
    });

    // 防護圍網
    const fence = new THREE.Mesh(
      new THREE.BoxGeometry(34.4, 3.2, 26.4),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true })
    );
    fence.position.y = 1.6;
    courtGroup.add(fence);

    courtGroup.userData = { buildingId: "b21" };
    this.scene.add(courtGroup);
    this.clickableObjects.push(courtBase);
  }

  buildEnvironmentAndLandmarks() {
    // 校園大道林蔭樹木群
    const treePositions = [
      [-160, 145], [-130, 145], [-80, 145], [-20, 145], [60, 145], [100, 145], [140, 145],
      [-165, 80], [-165, 40], [-165, 0], [-165, -40],
      [-50, 12], [-20, 25], [10, 25], [40, 25],
      [110, -10], [130, -10], [170, -10],
      [75, -80], [95, -80], [120, -135], [170, -145],
      [135, 120], [180, 120], [210, 120]
    ];

    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const leavesGeo = new THREE.SphereGeometry(2.4, 8, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });

    treePositions.forEach(([x, z]) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      tree.add(trunk);

      const leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.y = 4.2;
      leaves.castShadow = true;
      tree.add(leaves);

      this.scene.add(tree);
    });

    // 外圍重要地標看板 (澄清湖、長庚醫院停車場、濱山街)
    this.createSurroundingLabel("澄清湖", -230, 20, 0x0284c7);
    this.createSurroundingLabel("長庚醫院停車場 [P]", -30, -65, 0x3b82f6);
    this.createSurroundingLabel("濱山街 (商圈美食街)", 175, -200, 0x10b981);
    this.createSurroundingLabel("澄清路 (往圓山飯店/市區)", -50, 185, 0x475569);
  }

  createSurroundingLabel(name, x, z, bgColor = 0x0284c7) {
    const sprite = this.createTextSprite(name, "#ffffff", "#0f172a", 16);
    sprite.position.set(x, 10, z);
    sprite.scale.set(18, 7, 1);
    this.scene.add(sprite);
  }

  // 建構安全地圖所有 25 處標籤建築
  buildBuildings() {
    this.data.buildings.forEach(b => {
      const bGroup = new THREE.Group();
      bGroup.position.set(b.pos[0], b.pos[1], b.pos[2]);
      bGroup.userData = { buildingId: b.id, data: b };

      let visualGroup;

      switch (b.type) {
        case "gate":
          visualGroup = this.createGateMesh(b);
          break;
        case "parking":
          visualGroup = this.createParkingMesh(b);
          break;
        case "wide_admin":
          visualGroup = this.createWideAdminMesh(b); // 03 綜合大樓 (橫跨粉色)
          break;
        case "gymnasium":
          visualGroup = this.createGymnasiumMesh(b); // 04 體育室 (藍色體育館)
          break;
        case "tower":
          visualGroup = this.createTowerMesh(b); // 15 圖書科技大樓 (紫色12層地標)
          break;
        case "curved_front":
          visualGroup = this.createCurvedFrontMesh(b); // 11 人文大樓 / 22 幼保館 / 27 生活創意
          break;
        case "hall":
          visualGroup = this.createHallMesh(b); // 09 學生活動中心 (含2F健康中心)
          break;
        case "residential":
          visualGroup = this.createResidentialMesh(b); // 19 正修宿舍 (文山/正義)
          break;
        case "skybridge":
          visualGroup = this.createSkybridgeMesh(b); // 20 天橋
          break;
        case "stepped":
          visualGroup = this.createSteppedMesh(b); // 18 管理學院 / 29 產學共榮大樓
          break;
        case "high_tech":
          visualGroup = this.createHighTechLabMesh(b); // 23 超微量實驗室
          break;
        case "civil_eng":
          visualGroup = this.createCivilEngineeringMesh(b); // 07 土木工程館 (真實立面照片與超人力霸王)
          break;
        case "court":
          visualGroup = new THREE.Group(); // 已在 buildSportsCourtsAndTrack 建構
          break;
        default:
          visualGroup = this.createStandardBuildingMesh(b);
          break;
      }

      visualGroup.userData = { buildingId: b.id, data: b };
      bGroup.add(visualGroup);
      this.scene.add(bGroup);

      this.buildingMeshes.set(b.id, bGroup);
      this.clickableObjects.push(visualGroup);
    });
  }

  // 01 學校正門 (澄清路迎賓大門與警衛哨)
  createGateMesh(b) {
    const group = new THREE.Group();

    // 兩側大理石牌樓立柱
    [-10, 10].forEach(x => {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 9, 3.5),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3 })
      );
      p.position.set(x, 4.5, 0);
      p.castShadow = true;
      group.add(p);
    });

    // 正面紅色橫楣牌匾
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(24, 2.5, 3.8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    beam.position.set(0, 9, 0);
    beam.castShadow = true;
    group.add(beam);

    // 校名題字牌
    const nameplate = this.createTextSprite("正修科技大學", "#ffffff", "#b91c1c", 16);
    nameplate.position.set(0, 9.2, 2.1);
    nameplate.scale.set(16, 4, 1);
    group.add(nameplate);

    // 警衛傳達室
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(5, 3.5, 5),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    guard.position.set(14, 1.75, 0);
    guard.castShadow = true;
    group.add(guard);

    return group;
  }

  // 02 A、B棟停車場
  createParkingMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const d = b.size[2];

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, d),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
    );
    base.position.y = 0.2;
    base.receiveShadow = true;
    group.add(base);

    // 停車格線
    for (let i = -w / 2 + 5; i <= w / 2 - 5; i += 5) {
      const pLine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      pLine.rotation.x = -Math.PI / 2;
      pLine.position.set(i, 0.42, 0);
      group.add(pLine);

      // 停放車輛
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.3, 4.2),
        new THREE.MeshStandardMaterial({ color: [0x3b82f6, 0xef4444, 0xf8fafc, 0x10b981][Math.abs(Math.floor(i)) % 4] })
      );
      car.position.set(i, 1.1, 0);
      car.castShadow = true;
      group.add(car);
    }

    return group;
  }

  // 03 綜合大樓 (地圖橫跨正門後方之粉紫色宏偉行政中樞)
  createWideAdminMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0]; // 120m 寬
    const h = b.size[1]; // 22m 高
    const d = b.size[2]; // 24m 深

    // 主體粉紫粉紅牆面 (地圖色調)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0xd946ef, roughness: 0.4 })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 中央退縮上層塔樓
    const topTower = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.4, 6, d * 0.8),
      new THREE.MeshStandardMaterial({ color: 0xa21caf, roughness: 0.3 })
    );
    topTower.position.set(0, h + 3, 0);
    topTower.castShadow = true;
    group.add(topTower);

    // 屋頂深紫飾帶簷口
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1, 1, d + 1),
      new THREE.MeshStandardMaterial({ color: 0x86198f })
    );
    rim.position.y = h + 0.5;
    group.add(rim);

    // 前後立面窗格
    this.addWindowGrids(group, w, h, d, 0x3b82f6);

    // 迎賓入口大階梯
    const steps = new THREE.Mesh(
      new THREE.BoxGeometry(24, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1 })
    );
    steps.position.set(0, 0.6, d / 2 + 3);
    group.add(steps);

    return group;
  }

  // 04 體育室 (地圖正方形藍色室內體育館)
  createGymnasiumMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1];
    const d = b.size[2];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.8, d),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
    );
    body.position.y = (h * 0.8) / 2;
    body.castShadow = true;
    group.add(body);

    // 弧形挑高大頂棚
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.48, w * 0.5, d, 24),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.3 })
    );
    roof.rotation.x = Math.PI / 2;
    roof.position.y = h * 0.8;
    roof.castShadow = true;
    group.add(roof);

    return group;
  }

  // 15 圖書科技大樓 (地圖核心亮紫色十二層多翼高樓地標)
  createTowerMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1]; // 40m 高塔
    const d = b.size[2];

    // 紫色主塔身
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.3 })
    );
    tower.position.y = h / 2;
    tower.castShadow = true;
    group.add(tower);

    // 十字流線側翼
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.25, h * 0.7, d * 0.6),
      new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.3 })
    );
    wings.position.y = (h * 0.7) / 2;
    wings.castShadow = true;
    group.add(wings);

    // 正面高科技玻璃帷幕
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.6, h * 0.85),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.25
      })
    );
    glass.position.set(0, (h * 0.85) / 2 + 2, d / 2 + 0.15);
    group.add(glass);

    // 避雷天線塔
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.4, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8 })
    );
    mast.position.y = h + 6;
    group.add(mast);

    this.addWindowGrids(group, w, h, d, 0x0284c7);

    return group;
  }

  // 11 人文大樓 (黃色圓弧花瓣造型) / 22 幼保館 (橙色) / 27 生活創意 (藍色)
  createCurvedFrontMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1];
    const d = b.size[2];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d * 0.8),
      new THREE.MeshStandardMaterial({ color: b.color || 0xeab308, roughness: 0.3 })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);

    // 前端流線半圓弧柱體
    const curveGeo = new THREE.CylinderGeometry(w * 0.45, w * 0.45, h, 32, 1, false, 0, Math.PI);
    const curveMat = new THREE.MeshStandardMaterial({ color: b.color || 0xeab308, roughness: 0.3 });
    const curveMesh = new THREE.Mesh(curveGeo, curveMat);
    curveMesh.position.set(0, h / 2, (d * 0.8) / 2);
    curveMesh.castShadow = true;
    group.add(curveMesh);

    // 若為 11 人文大樓，加上 7-ELEVEN 標誌
    if (b.id === "b11") {
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 128;
      signCanvas.height = 36;
      const ctx = signCanvas.getContext("2d");
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(0, 0, 128, 12);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 12, 128, 12);
      ctx.fillStyle = "#15803d";
      ctx.fillRect(0, 24, 128, 12);
      ctx.fillStyle = "#ea580c";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("7-ELEVEn", 64, 26);

      const signTexture = new THREE.CanvasTexture(signCanvas);
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 2.8),
        new THREE.MeshBasicMaterial({ map: signTexture })
      );
      signMesh.position.set(0, 4, d / 2 + 2);
      group.add(signMesh);
    }

    // 若為 22 幼保館，加上全校「校安中心 (S標章)」盾牌告示
    if (b.id === "b22") {
      const safetySign = this.createTextSprite("🛡️ 校安中心 (S)", "#ffffff", "#dc2626", 14);
      safetySign.position.set(0, h + 3, 0);
      safetySign.scale.set(16, 5, 1);
      group.add(safetySign);
    }

    this.addWindowGrids(group, w, h, d, b.accentColor || 0x2563eb);

    return group;
  }

  // 09 學生活動中心 (大禮堂挑高弧頂、1F學生餐廳、2F健康中心)
  createHallMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1];
    const d = b.size[2];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.7, d),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
    );
    body.position.y = (h * 0.7) / 2;
    body.castShadow = true;
    group.add(body);

    // 圓頂大禮堂
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.45, w * 0.48, h * 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3 })
    );
    roof.position.y = h * 0.7 + (h * 0.35) / 2;
    roof.castShadow = true;
    group.add(roof);

    // 2F 健康中心 標示牌 (含十字紅十字)
    const healthSign = this.createTextSprite("✚ 2F 健康中心", "#ffffff", "#dc2626", 14);
    healthSign.position.set(0, 8, d / 2 + 1);
    healthSign.scale.set(12, 3.5, 1);
    group.add(healthSign);

    this.addWindowGrids(group, w, h * 0.7, d, 0xf43f5e);

    return group;
  }

  // 19 正修宿舍 (文山學園 / 正義學舍，紫色大樓群)
  createResidentialMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1];
    const d = b.size[2];

    // 雙翼宿舍棟
    const wing1 = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.45, h, d),
      new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.5 })
    );
    wing1.position.set(-w * 0.25, h / 2, 0);
    wing1.castShadow = true;

    const wing2 = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.45, h, d),
      new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.5 })
    );
    wing2.position.set(w * 0.25, h / 2, 0);
    wing2.castShadow = true;

    // 中央連通道
    const connector = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.2, h * 0.8, d * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x7e22ce })
    );
    connector.position.set(0, (h * 0.8) / 2, 0);

    group.add(wing1, wing2, connector);

    // 宿舍名稱看板 (文山學園 / 正義學舍)
    const labelWenshan = this.createTextSprite("文山學園", "#ffffff", "#7e22ce", 14);
    labelWenshan.position.set(-w * 0.25, h + 3, 0);
    labelWenshan.scale.set(12, 4, 1);

    const labelZhengyi = this.createTextSprite("正義學舍", "#ffffff", "#7e22ce", 14);
    labelZhengyi.position.set(w * 0.25, h + 3, 0);
    labelZhengyi.scale.set(12, 4, 1);

    group.add(labelWenshan, labelZhengyi);

    this.addWindowGrids(group, w, h, d, 0x475569);

    return group;
  }

  // 20 天橋 (跨越馬路連通正修宿舍之安全行人天橋)
  createSkybridgeMesh(b) {
    const group = new THREE.Group();
    const len = b.size[0]; // 36m
    const h = b.size[1];   // 7m

    // 橋面主樑
    const bridgeDeck = new THREE.Mesh(
      new THREE.BoxGeometry(len, 1.2, 5),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 })
    );
    bridgeDeck.position.y = h;
    bridgeDeck.castShadow = true;
    group.add(bridgeDeck);

    // 兩側安全強化玻璃護欄
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1
    });
    [-2.3, 2.3].forEach(zOffset => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 1.5, 0.2), guardMat);
      rail.position.set(0, h + 1.2, zOffset);
      group.add(rail);
    });

    // 兩端橋墩立柱與階梯引道
    [-len / 2 + 1, len / 2 - 1].forEach(px => {
      const pier = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, h, 12),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a })
      );
      pier.position.set(px, h / 2, 0);
      pier.castShadow = true;
      group.add(pier);

      // 上下階梯斜坡
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.5, 3.5),
        new THREE.MeshStandardMaterial({ color: 0x64748b })
      );
      ramp.position.set(px, h / 2, (px < 0 ? -4 : 4));
      ramp.rotation.x = px < 0 ? 0.3 : -0.3;
      group.add(ramp);
    });

    return group;
  }

  // 23 超微量實驗室 (高科技潔淨外觀與百葉排氣機組)
  createHighTechLabMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1];
    const d = b.size[2];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.4 })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);

    // 高科技夜間發光飾條
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 1.2, d + 0.4),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.5 })
    );
    band.position.y = h * 0.7;
    group.add(band);

    // 屋頂精密通風排氣機組
    for (let i = -6; i <= 6; i += 6) {
      const vent = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 2.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
      );
      vent.position.set(i, h + 1.25, 0);
      group.add(vent);
    }

    return group;
  }

  // 18 管理學院 / 29 產學大樓 (多段退縮階梯式現代大樓)
  createSteppedMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1];
    const d = b.size[2];

    const b1 = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.6, d),
      new THREE.MeshStandardMaterial({ color: b.color || 0x3b82f6, roughness: 0.4 })
    );
    b1.position.y = (h * 0.6) / 2;
    b1.castShadow = true;
    group.add(b1);

    const b2 = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.75, h * 0.4, d * 0.75),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    b2.position.set(w * 0.1, h * 0.6 + (h * 0.4) / 2, 0);
    b2.castShadow = true;
    group.add(b2);

    this.addWindowGrids(group, w, h * 0.6, d, b.accentColor || 0x2563eb);

    return group;
  }

  // 07 土木工程館 (土木系館) - 實景正面照片無閃爍無遮擋精準貼圖
  createCivilEngineeringMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0]; // 22m
    const h = b.size[1]; // 16m
    const d = b.size[2]; // 18m

    // 1. 主建物紅褐色面磚結構 (比照真實照片紅面磚色調 #9a3412)
    const brickMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      roughness: 0.7,
      metalness: 0.05
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 屋頂女兒牆與頂部深色邊框
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x571c08, roughness: 0.6 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.9, d + 0.6), roofMat);
    roof.position.y = h + 0.45;
    group.add(roof);

    // 2. 正面 (+Z) 真實照片面板 (徹底杜絕 Z-fighting 閃爍)
    // 照片解析度 1024x1008 (比例約 1.016:1)
    const panelW = 16.0;
    const panelH = 15.2;

    // 後方深色實體邊框基座 (厚度 0.3m，前表面位於 d/2 + 0.25m)
    const frameGeo = new THREE.BoxGeometry(panelW + 0.6, panelH + 0.4, 0.3);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d1a0e, roughness: 0.5 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(0, panelH / 2 + 0.4, d / 2 + 0.1);
    group.add(frameMesh);

    // 照片貼圖材質
    const textureLoader = new THREE.TextureLoader();
    const facadeTexture = textureLoader.load("assets/civil_eng_facade.jpg");
    facadeTexture.generateMipmaps = true;
    facadeTexture.minFilter = THREE.LinearMipmapLinearFilter;
    facadeTexture.magFilter = THREE.LinearFilter;

    // 照片平面：厚度獨立置於 d/2 + 0.28m (前方 3cm 處)，並開啟 polygonOffset 雙重防護，徹底根除任何閃爍
    const facadeGeo = new THREE.PlaneGeometry(panelW, panelH);
    const facadeMat = new THREE.MeshStandardMaterial({
      map: facadeTexture,
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const facadeMesh = new THREE.Mesh(facadeGeo, facadeMat);
    facadeMesh.position.set(0, panelH / 2 + 0.4, d / 2 + 0.28);
    facadeMesh.castShadow = true;
    group.add(facadeMesh);

    // 3. 正門前寬敞低矮迎賓階梯 (完全不遮擋上方照片中的大門與超人)
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(panelW + 2, 0.2, 3.2), stepMat);
    step1.position.set(0, 0.1, d / 2 + 1.6);
    step1.receiveShadow = true;
    group.add(step1);

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.2, 2.2), stepMat);
    step2.position.set(0, 0.3, d / 2 + 1.1);
    step2.receiveShadow = true;
    group.add(step2);

    // 4. 背面與兩側窗格 (僅在 -Z 後方、+X 東側、-X 西側生成，絕不在正面 +Z 生成，根除深度衝突)
    this.addNonFrontWindowGrids(group, w, h, d, 0xf97316);

    return group;
  }

  // 專門用於正面有獨立照片貼圖的建築物：只在背面與兩側生成窗格，不干擾正面
  addNonFrontWindowGrids(group, w, h, d, accentColor) {
    const winCanvas = document.createElement("canvas");
    winCanvas.width = 128;
    winCanvas.height = 128;
    const ctx = winCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = "#334155";
    for (let r = 10; r < 120; r += 24) {
      for (let c = 8; c < 120; c += 18) {
        ctx.fillRect(c, r, 12, 16);
      }
    }

    const winTexture = new THREE.CanvasTexture(winCanvas);
    winTexture.wrapS = THREE.RepeatWrapping;
    winTexture.wrapT = THREE.RepeatWrapping;

    const winMat = new THREE.MeshStandardMaterial({ map: winTexture, roughness: 0.3, metalness: 0.2 });

    // 北側背面窗格 (-Z)
    const facadeBack = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.85), winMat);
    facadeBack.rotation.y = Math.PI;
    facadeBack.position.set(0, h * 0.45, -d / 2 - 0.05);
    group.add(facadeBack);

    // 東側側面窗格 (+X)
    const facadeEast = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.85, h * 0.85), winMat);
    facadeEast.rotation.y = Math.PI / 2;
    facadeEast.position.set(w / 2 + 0.05, h * 0.45, 0);
    group.add(facadeEast);

    // 西側側面窗格 (-X)
    const facadeWest = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.85, h * 0.85), winMat);
    facadeWest.rotation.y = -Math.PI / 2;
    facadeWest.position.set(-w / 2 - 0.05, h * 0.45, 0);
    group.add(facadeWest);
  }

  // 通用教學館舍
  createStandardBuildingMesh(b) {
    const group = new THREE.Group();
    const w = b.size[0];
    const h = b.size[1];
    const d = b.size[2];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: b.color || 0xe2e8f0, roughness: 0.4 })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);

    if (b.roofColor) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
        new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.5 })
      );
      roof.position.y = h + 0.4;
      group.add(roof);
    }

    // 若有電機工程館，在頂樓加上太陽能光電陣列板
    if (b.id === "b16") {
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8 });
      for (let px = -6; px <= 6; px += 4) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 4), panelMat);
        panel.rotation.x = Math.PI / 8;
        panel.position.set(px, h + 1.2, 0);
        group.add(panel);
      }
    }

    this.addWindowGrids(group, w, h, d, b.accentColor || 0x3b82f6);

    return group;
  }

  // 雙向立面窗格
  addWindowGrids(group, w, h, d, accentColor) {
    const winCanvas = document.createElement("canvas");
    winCanvas.width = 128;
    winCanvas.height = 128;
    const ctx = winCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = "#334155";
    for (let r = 10; r < 120; r += 24) {
      for (let c = 8; c < 120; c += 18) {
        ctx.fillRect(c, r, 12, 16);
      }
    }

    const winTexture = new THREE.CanvasTexture(winCanvas);
    winTexture.wrapS = THREE.RepeatWrapping;
    winTexture.wrapT = THREE.RepeatWrapping;
    winTexture.repeat.set(Math.max(1, Math.floor(w / 8)), Math.max(1, Math.floor(h / 6)));

    const winMat = new THREE.MeshStandardMaterial({ map: winTexture, roughness: 0.3, metalness: 0.2 });

    const facadeFront = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.85), winMat);
    facadeFront.position.set(0, h * 0.45, d / 2 + 0.05);
    group.add(facadeFront);

    const facadeBack = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.85), winMat);
    facadeBack.rotation.y = Math.PI;
    facadeBack.position.set(0, h * 0.45, -d / 2 - 0.05);
    group.add(facadeBack);
  }

  // 建立建築地標 3D 浮動編號卡
  buildBuildingPins() {
    this.data.buildings.forEach(b => {
      const pin = this.createBuildingPinSprite(b.number, b.name, b.hasAED);
      pin.position.set(b.pos[0], b.pos[1] + b.size[1] + 8, b.pos[2]);
      pin.userData = { buildingId: b.id, data: b };
      this.scene.add(pin);
      this.buildingPins.set(b.id, pin);
      this.clickableObjects.push(pin);
    });
  }

  createBuildingPinSprite(num, name, hasAED = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    // 圓角底框
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = hasAED ? "#ef4444" : "#38bdf8";
    ctx.lineWidth = 4;
    this.roundRect(ctx, 8, 8, 240, 92, 22);
    ctx.fill();
    ctx.stroke();

    // 編號圓徽
    ctx.fillStyle = hasAED ? "#ef4444" : "#0284c7";
    ctx.beginPath();
    ctx.arc(48, 54, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, 48, 55);

    // 名稱
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px 'Noto Sans TC', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(name.length > 7 ? name.slice(0, 7) : name, 88, 54);

    // 若有 AED，加上愛心小圖標
    if (hasAED) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("♥AED", 185, 30);
    }

    // 倒三角指標
    ctx.fillStyle = hasAED ? "#ef4444" : "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(118, 100);
    ctx.lineTo(138, 100);
    ctx.lineTo(128, 120);
    ctx.closePath();
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(16, 8, 1);
    return sprite;
  }

  // 建立夜間加強照明走廊 (金黃色安全步道) 與 13 處緊急求助鈴柱
  buildSafetyFacilities() {
    this.nightLightingLinesGroup = new THREE.Group();

    // 1. 夜間加強照明走廊 (依照校園安全地圖黃色動線繪製之高辨識度金黃步道，完全無建築穿插)
    const segments = this.data.nightLightingSegments || [];
    const roadWidth = 5.2; // 5.2公尺寬敞平坦步道
    const hw = roadWidth / 2;
    const yRoad = 0.12;    // 緊貼地面且略高於草皮，防止深度衝突

    // 主道路平坦金黃材質 (安全地圖標準明亮金黃)
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.45,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.roadMaterial = roadMat;

    // 道路邊緣保護緣石/界線 (琥珀色安全標線)
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      side: THREE.DoubleSide
    });
    this.curbMaterial = curbMat;

    const junctionSet = new Set();

    const addQuad = (p1, p2, p3, p4, mat, yOffset = 0) => {
      const geo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        p1[0], p1[1] + yOffset, p1[2],
        p2[0], p2[1] + yOffset, p2[2],
        p3[0], p3[1] + yOffset, p3[2],
        p4[0], p4[1] + yOffset, p4[2]
      ]);
      const indices = [0, 2, 1, 1, 2, 3];
      geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      this.nightLightingLinesGroup.add(mesh);
    };

    segments.forEach(([pA, pB]) => {
      const x1 = pA[0], z1 = pA[1];
      const x2 = pB[0], z2 = pB[1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) return;

      const nx = -dz / len;
      const nz = dx / len;

      junctionSet.add(`${x1.toFixed(1)},${z1.toFixed(1)}`);
      junctionSet.add(`${x2.toFixed(1)},${z2.toFixed(1)}`);

      // 寬度 5.2m 主路帶
      const v1 = [x1 - nx * hw, yRoad, z1 - nz * hw];
      const v2 = [x1 + nx * hw, yRoad, z1 + nz * hw];
      const v3 = [x2 - nx * hw, yRoad, z2 - nz * hw];
      const v4 = [x2 + nx * hw, yRoad, z2 + nz * hw];
      addQuad(v1, v2, v3, v4, roadMat, 0);

      // 左側 0.35m 安全緣石
      const cL1 = [x1 - nx * hw, yRoad, z1 - nz * hw];
      const cL2 = [x1 - nx * (hw - 0.35), yRoad, z1 - nz * (hw - 0.35)];
      const cL3 = [x2 - nx * hw, yRoad, z2 - nz * hw];
      const cL4 = [x2 - nx * (hw - 0.35), yRoad, z2 - nz * (hw - 0.35)];
      addQuad(cL1, cL2, cL3, cL4, curbMat, 0.002);

      // 右側 0.35m 安全緣石
      const cR1 = [x1 + nx * (hw - 0.35), yRoad, z1 + nz * (hw - 0.35)];
      const cR2 = [x1 + nx * hw, yRoad, z1 + nz * hw];
      const cR3 = [x2 + nx * (hw - 0.35), yRoad, z2 + nz * (hw - 0.35)];
      const cR4 = [x2 + nx * hw, yRoad, z2 + nz * hw];
      addQuad(cR1, cR2, cR3, cR4, curbMat, 0.002);
    });

    // 在所有道路轉角與路口處放置平滑圓形鋪面節點，確保所有交叉無縫銜接
    junctionSet.forEach(coordKey => {
      const [jx, jz] = coordKey.split(",").map(Number);
      const circleGeo = new THREE.CircleGeometry(hw, 24);
      circleGeo.rotateX(-Math.PI / 2);
      const disc = new THREE.Mesh(circleGeo, roadMat);
      disc.position.set(jx, yRoad + 0.001, jz);
      disc.receiveShadow = true;
      this.nightLightingLinesGroup.add(disc);
    });

    this.scene.add(this.nightLightingLinesGroup);

    // 2. 13 處戶外緊急求助鈴柱 (紅燈閃爍標誌)
    this.data.emergencyBells.forEach(bell => {
      const bellGroup = new THREE.Group();
      bellGroup.position.set(bell.pos[0], 0, bell.pos[2]);

      // 鈴柱本體
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 4.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xef4444 })
      );
      pole.position.y = 2.25;
      bellGroup.add(pole);

      // 紅色閃爍警戒信號燈
      const beaconGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.8
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 4.8;
      bellGroup.add(beacon);

      const pLight = new THREE.PointLight(0xef4444, 0.6, 12);
      pLight.position.y = 4.8;
      bellGroup.add(pLight);

      this.emergencyBeacons.push({ mesh: beacon, light: pLight });
      this.scene.add(bellGroup);
    });
  }

  createTextSprite(text, fgColor = "#ffffff", bgColor = "#0284c7", fontSize = 16) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = bgColor;
    this.roundRect(ctx, 4, 4, 248, 56, 12);
    ctx.fill();

    ctx.fillStyle = fgColor;
    ctx.font = `bold ${fontSize * 1.5}px 'Noto Sans TC', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  drawNavigationPath(points) {
    if (this.navigationPathMesh) {
      this.scene.remove(this.navigationPathMesh);
      this.navigationPathMesh.geometry.dispose();
      this.navigationPathMesh = null;
    }

    if (!points || points.length < 2) return;

    const elevatedPoints = points.map(p => new THREE.Vector3(p.x, 0.5, p.z));
    this.pathCurve = new THREE.CatmullRomCurve3(elevatedPoints);
    this.pathCurve.curveType = "catmullrom";
    this.pathCurve.tension = 0.2;

    const tubeGeo = new THREE.TubeGeometry(this.pathCurve, 128, 0.9, 8, false);

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.9)");
    grad.addColorStop(0.5, "rgba(255, 255, 255, 1)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 16);

    const pathTexture = new THREE.CanvasTexture(canvas);
    pathTexture.wrapS = THREE.RepeatWrapping;
    pathTexture.repeat.set(24, 1);

    const tubeMat = new THREE.MeshStandardMaterial({
      map: pathTexture,
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    this.navigationPathMesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.scene.add(this.navigationPathMesh);
  }

  clearNavigationPath() {
    if (this.navigationPathMesh) {
      this.scene.remove(this.navigationPathMesh);
      this.navigationPathMesh.geometry.dispose();
      this.navigationPathMesh = null;
      this.pathCurve = null;
    }
  }

  flyToBuilding(buildingId, duration = 1500) {
    const b = this.data.buildings.find(item => item.id === buildingId);
    if (!b) return;

    let targetPos = new THREE.Vector3(b.pos[0], b.size[1] / 2, b.pos[2]);
    let cameraOffset = new THREE.Vector3(b.pos[0] - 40, b.size[1] + 35, b.pos[2] + 55);

    // 07 土木工程館特寫：正面平視角度欣賞實景立面與超人力霸王
    if (buildingId === "b07") {
      targetPos = new THREE.Vector3(b.pos[0] - 1, 7.5, b.pos[2]);
      cameraOffset = new THREE.Vector3(b.pos[0] - 1, 8.5, b.pos[2] + 32);
    }

    this.animateCamera(cameraOffset, targetPos, duration);
    this.selectBuilding(buildingId, false);
  }

  animateCamera(toPos, toTarget, duration = 1200, onComplete = null) {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    new TWEEN.Tween({ t: 0 })
      .to({ t: 1 }, duration)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(({ t }) => {
        this.camera.position.lerpVectors(startPos, toPos, t);
        this.controls.target.lerpVectors(startTarget, toTarget, t);
      })
      .onComplete(() => {
        if (onComplete) onComplete();
      })
      .start();
  }

  selectBuilding(buildingId, triggerCallback = true) {
    this.selectedBuilding = buildingId;

    this.buildingPins.forEach((pin, id) => {
      if (id === buildingId) {
        pin.scale.set(20, 10, 1);
      } else {
        pin.scale.set(16, 8, 1);
      }
    });

    if (triggerCallback && this.onSelectBuilding) {
      const bData = this.data.buildings.find(b => b.id === buildingId);
      this.onSelectBuilding(bData);
    }
  }

  setTimeMode(mode) {
    this.timeMode = mode;

    if (mode === "day") {
      this.scene.background = new THREE.Color(0xbbf2f6);
      this.scene.fog.color = new THREE.Color(0xbbf2f6);
      this.lights.ambient.color.setHex(0xffffff);
      this.lights.ambient.intensity = 0.75;
      this.lights.hemi.color.setHex(0xffffff);
      this.lights.hemi.intensity = 0.5;
      this.lights.sun.color.setHex(0xfffaed);
      this.lights.sun.intensity = 1.3;

      if (this.nightLightingLinesGroup) {
        this.nightLightingLinesGroup.children.forEach(line => {
          line.material.emissiveIntensity = 0.4;
        });
      }
    } else if (mode === "sunset") {
      this.scene.background = new THREE.Color(0xfdba74);
      this.scene.fog.color = new THREE.Color(0xfdba74);
      this.lights.ambient.color.setHex(0xfed7aa);
      this.lights.ambient.intensity = 0.6;
      this.lights.hemi.color.setHex(0xf97316);
      this.lights.hemi.intensity = 0.4;
      this.lights.sun.color.setHex(0xf97316);
      this.lights.sun.intensity = 1.6;

      if (this.nightLightingLinesGroup) {
        this.nightLightingLinesGroup.children.forEach(line => {
          line.material.emissiveIntensity = 0.8;
        });
      }
    } else if (mode === "night") {
      this.scene.background = new THREE.Color(0x090d16);
      this.scene.fog.color = new THREE.Color(0x090d16);
      this.lights.ambient.color.setHex(0x1e293b);
      this.lights.ambient.intensity = 0.3;
      this.lights.hemi.color.setHex(0x0f172a);
      this.lights.hemi.intensity = 0.2;
      this.lights.sun.color.setHex(0x38bdf8);
      this.lights.sun.intensity = 0.25;

      // 夜間加強照明走廊金黃色強力發光！
      if (this.nightLightingLinesGroup) {
        this.nightLightingLinesGroup.children.forEach(line => {
          line.material.emissiveIntensity = 1.8;
        });
      }
    }
  }

  setPresetView(viewKey) {
    switch (viewKey) {
      case "overview":
        this.animateCamera(new THREE.Vector3(30, 260, 250), new THREE.Vector3(30, 0, 10));
        break;
      case "gate":
        this.animateCamera(new THREE.Vector3(-50, 18, 195), new THREE.Vector3(-50, 10, 120));
        break;
      case "library":
        this.animateCamera(new THREE.Vector3(80, 45, 15), new THREE.Vector3(135, 20, -45));
        break;
      case "civil":
        // 聚焦 07 土木系館正面特寫視角 (清晰觀賞立面照片、超人與迎賓門廊)
        this.animateCamera(new THREE.Vector3(-146, 8.5, 42), new THREE.Vector3(-146, 7.5, 10));
        break;
      case "sports":
        this.animateCamera(new THREE.Vector3(40, 45, 45), new THREE.Vector3(40, 0, -15));
        break;
      case "dorm":
        this.animateCamera(new THREE.Vector3(110, 35, -120), new THREE.Vector3(160, 15, -185));
        break;
      case "safety":
        this.animateCamera(new THREE.Vector3(-20, 35, 55), new THREE.Vector3(-20, 10, -5));
        break;
    }
  }

  // === 校園第一人稱貼地行走模式 (Campus Ground Walking Mode) ===
  initWalkingMode() {
    this.walkEyeHeight = 1.8; // 行人視線高度 (離地面 1.8 公尺)
    this.walkPos = new THREE.Vector3(-50, 1.8, 145); // 預設正門出發點
    this.walkYaw = 0;   // 水平旋轉角
    this.walkPitch = 0; // 仰俯角
    this.walkSpeed = 16; // 步行速度
    this.isRunning = false;
    this.walkStepCycle = 0;
    this.walkKeys = { forward: false, backward: false, left: false, right: false, turnLeft: false, turnRight: false };

    this.isAutoWalking = false;
    this.autoWalkPathIndex = 0;
    this.autoWalkNodes = [
      [-50, 150],  // 01 學校正門 (澄清路迎賓大門)
      [-50, 122],  // 03 綜合大樓前迎賓廣場路口
      [-122, 122], // 02 西側停車場通道
      [-122, 24],  // 06 電子館 / 07 土木工程館路口
      [-45, 24],   // 04 體育室南側路口
      [-45, 12],   // 22 幼保館(校安中心)西側路口
      [20, 10],    // 22 幼保館 / 校安中心前正門大道
      [24, -30],   // 25 學校側門路口
      [55, -36],   // 11 人文大樓圓弧花園前
      [95, -38],   // 11 人文大樓 7-11 前庭
      [125, -38],  // 15 圖書科技大樓文化廣場
      [108, -48],  // 往 16 電機館北向大道口
      [108, -115], // 16 電機工程館西側
      [115, -150], // 20 天橋南引道
      [130, -170], // 20 天橋跨街正下方
      [145, -178]  // 19 正修宿舍 (文山/正義) 前廣場
    ];

    // 鍵盤移動監聽 (WASD 與 方向鍵)
    window.addEventListener("keydown", (e) => {
      if (!this.isWalkingMode) return;
      if (e.code === "KeyW" || e.code === "ArrowUp") { this.walkKeys.forward = true; e.preventDefault(); }
      if (e.code === "KeyS" || e.code === "ArrowDown") { this.walkKeys.backward = true; e.preventDefault(); }
      if (e.code === "KeyA") { this.walkKeys.left = true; e.preventDefault(); }
      if (e.code === "KeyD") { this.walkKeys.right = true; e.preventDefault(); }
      if (e.code === "ArrowLeft") { this.walkKeys.turnLeft = true; e.preventDefault(); }
      if (e.code === "ArrowRight") { this.walkKeys.turnRight = true; e.preventDefault(); }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") { this.isRunning = true; }
    });

    window.addEventListener("keyup", (e) => {
      if (!this.isWalkingMode) return;
      if (e.code === "KeyW" || e.code === "ArrowUp") this.walkKeys.forward = false;
      if (e.code === "KeyS" || e.code === "ArrowDown") this.walkKeys.backward = false;
      if (e.code === "KeyA") this.walkKeys.left = false;
      if (e.code === "KeyD") this.walkKeys.right = false;
      if (e.code === "ArrowLeft") this.walkKeys.turnLeft = false;
      if (e.code === "ArrowRight") this.walkKeys.turnRight = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.isRunning = false;
    });

    // 滑鼠按住拖曳視角
    let isMouseDown = false;
    let prevMouseX = 0, prevMouseY = 0;
    this.renderer.domElement.addEventListener("mousedown", (e) => {
      if (this.isWalkingMode) {
        isMouseDown = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isWalkingMode && isMouseDown) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        this.walkYaw -= dx * 0.0035;
        this.walkPitch -= dy * 0.003;
        this.walkPitch = Math.max(-Math.PI / 2.6, Math.min(Math.PI / 2.6, this.walkPitch));
      }
    });

    window.addEventListener("mouseup", () => {
      isMouseDown = false;
    });
  }

  enterWalkingMode(startCoords = [-50, 135]) {
    this.isWalkingMode = true;
    this.isAutoWalking = false;
    this.controls.enabled = false;

    // 設定起點在校園地面 (高度 1.8 公尺)
    this.walkPos.set(startCoords[0], this.walkEyeHeight, startCoords[1]);
    this.walkYaw = 0; // 面對北方綜合大樓進入校園
    this.walkPitch = 0;

    const targetCameraPos = this.walkPos.clone();
    const lookTarget = targetCameraPos.clone().add(new THREE.Vector3(0, 0, -20));

    this.animateCamera(targetCameraPos, lookTarget, 1000, () => {
      // 相機已平滑降落至地面
    });

    if (this.onWalkingModeChange) {
      this.onWalkingModeChange(true, startCoords);
    }
  }

  exitWalkingMode() {
    this.isWalkingMode = false;
    this.isAutoWalking = false;
    this.controls.enabled = true;

    // 平滑升回鳥瞰視角
    const overviewPos = new THREE.Vector3(this.walkPos.x - 30, 160, this.walkPos.z + 160);
    const target = new THREE.Vector3(this.walkPos.x, 5, this.walkPos.z);
    this.animateCamera(overviewPos, target, 1200);

    if (this.onWalkingModeChange) {
      this.onWalkingModeChange(false);
    }
  }

  toggleWalkingMode() {
    if (this.isWalkingMode) {
      this.exitWalkingMode();
    } else {
      this.enterWalkingMode();
    }
    return this.isWalkingMode;
  }

  setWalkingKey(key, value) {
    if (this.walkKeys.hasOwnProperty(key)) {
      this.walkKeys[key] = value;
    }
  }

  toggleAutoWalk() {
    this.isAutoWalking = !this.isAutoWalking;
    return this.isAutoWalking;
  }

  updateWalker(delta) {
    if (!this.isWalkingMode) return;

    if (this.isAutoWalking) {
      // 自動貼地導覽漫步：順著校園步道循序前進
      const next = this.autoWalkNodes[(this.autoWalkPathIndex + 1) % this.autoWalkNodes.length];
      const targetPos = new THREE.Vector3(next[0], this.walkEyeHeight, next[1]);

      const dir = targetPos.clone().sub(this.walkPos);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 2.0) {
        this.autoWalkPathIndex = (this.autoWalkPathIndex + 1) % this.autoWalkNodes.length;
      } else {
        dir.normalize();
        const moveDist = (this.isRunning ? 22 : 12) * delta;
        this.walkPos.addScaledVector(dir, moveDist);
        this.walkYaw = Math.atan2(-dir.x, -dir.z);
        this.walkStepCycle += delta * 7;
      }
    } else {
      // 手動貼地漫步：WASD、方向鍵或虛擬手把
      if (this.walkKeys.turnLeft) this.walkYaw += 2.2 * delta;
      if (this.walkKeys.turnRight) this.walkYaw -= 2.2 * delta;

      const speed = (this.isRunning ? this.walkSpeed * 2 : this.walkSpeed) * delta;
      const forwardDir = new THREE.Vector3(-Math.sin(this.walkYaw), 0, -Math.cos(this.walkYaw));
      const rightDir = new THREE.Vector3(-forwardDir.z, 0, forwardDir.x);

      let isMoving = false;
      if (this.walkKeys.forward) {
        this.walkPos.addScaledVector(forwardDir, speed);
        isMoving = true;
      }
      if (this.walkKeys.backward) {
        this.walkPos.addScaledVector(forwardDir, -speed * 0.7);
        isMoving = true;
      }
      if (this.walkKeys.left) {
        this.walkPos.addScaledVector(rightDir, -speed * 0.7);
        isMoving = true;
      }
      if (this.walkKeys.right) {
        this.walkPos.addScaledVector(rightDir, speed * 0.7);
        isMoving = true;
      }

      if (isMoving) {
        this.walkStepCycle += delta * (this.isRunning ? 12 : 8);
      }
    }

    // 限制在校園地表邊界內
    this.walkPos.x = Math.max(-170, Math.min(220, this.walkPos.x));
    this.walkPos.z = Math.max(-190, Math.min(155, this.walkPos.z));

    // 擬真人類行走腳步起伏 (Head Bobbing)
    const bob = Math.sin(this.walkStepCycle) * 0.08;
    this.camera.position.set(this.walkPos.x, this.walkEyeHeight + bob, this.walkPos.z);

    // 計算視線前瞻點
    const lookDir = new THREE.Vector3(
      -Math.sin(this.walkYaw) * Math.cos(this.walkPitch),
      Math.sin(this.walkPitch),
      -Math.cos(this.walkYaw) * Math.cos(this.walkPitch)
    );
    const lookTarget = this.camera.position.clone().add(lookDir.multiplyScalar(15));
    this.camera.lookAt(lookTarget);
    this.controls.target.copy(lookTarget);
  }

  bindEvents() {
    window.addEventListener("resize", () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    const getRaycastBuilding = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.clickableObjects, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && (!obj.userData || !obj.userData.buildingId)) {
          obj = obj.parent;
        }
        return obj ? obj.userData.buildingId : null;
      }
      return null;
    };

    this.renderer.domElement.addEventListener("mousemove", (e) => {
      const bId = getRaycastBuilding(e);
      this.container.style.cursor = bId ? "pointer" : "default";
    });

    this.renderer.domElement.addEventListener("click", (e) => {
      const bId = getRaycastBuilding(e);
      if (bId) {
        this.selectBuilding(bId, true);
      }
    });
  }

  animate(time) {
    requestAnimationFrame(this.animate);

    TWEEN.update();

    const delta = Math.min(this.clock.getDelta(), 0.1);
    if (this.isWalkingMode) {
      this.updateWalker(delta);
    } else {
      this.controls.update();
    }

    // 1. 澄清湖波光微波動畫
    if (this.waterMesh) {
      this.waterMesh.material.opacity = 0.8 + Math.sin(time * 0.002) * 0.05;
    }

    // 2. 導航路徑流動動畫
    if (this.navigationPathMesh && this.navigationPathMesh.material.map) {
      this.pathAnimOffset -= 0.015;
      this.navigationPathMesh.material.map.offset.x = this.pathAnimOffset;
    }

    // 3. 3D 浮動標籤上下輕微懸浮呼吸
    const bob = Math.sin(time * 0.003) * 0.8;
    this.buildingPins.forEach((pin, id) => {
      const b = this.data.buildings.find(item => item.id === id);
      if (b) {
        pin.position.y = b.pos[1] + b.size[1] + 8 + bob;
      }
    });

    // 4. 13 處緊急求助鈴紅色信號燈呼吸閃爍動畫
    const pulse = 0.6 + Math.sin(time * 0.006) * 0.4;
    this.emergencyBeacons.forEach(({ mesh, light }) => {
      mesh.material.emissiveIntensity = pulse;
      light.intensity = pulse * 0.8;
    });

    this.renderer.render(this.scene, this.camera);
  }
}
