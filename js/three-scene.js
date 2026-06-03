/**
 * Hyper-Realistic 3D WebGL Holographic Dashboard Engine
 * Powered by Three.js (r128). Implements highly responsive hardware-accelerated financial metrics cockpit.
 */

// Safe fallback global toast system to prevent runtime scope errors
window.showToast = window.showToast || function(message, type = 'success') {
    const toast = document.getElementById('toast-message');
    if (toast) {
        toast.textContent = message;
        toast.className = 'toast-msg';
        if (type === 'error') toast.classList.add('toast-error');
        else if (type === 'info') toast.classList.add('toast-info');
        else toast.classList.add('toast-success');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    } else {
        console.log(`[Toast] ${type}: ${message}`);
    }
};

class Holographic3DScene {
    constructor(containerId, canvasId, tooltipId) {
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById(canvasId);
        this.tooltip = document.getElementById(tooltipId);
        
        if (!this.container || !this.canvas) {
            console.error("3D Hologram Scene viewport targets missing.");
            return;
        }

        // Initialize state variables
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.interactiveObjects = [];
        this.hoveredObject = null;
        this.autopilot = false;
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        
        // Parallax coordinates
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.currentRotationX = 0;
        this.currentRotationY = 0;
        
        // Active DB variables
        this.trades = [];
        this.settings = {};
        
        // Meshes tracking
        this.supportOrb = null;
        this.calendarGridGroup = null;
        this.chartsGroup = null;
        this.equityGroup = null;
        this.psychologyGroup = null;
        
        this.initEngine();
        this.setupLights();
        this.animate = this.animate.bind(this);
        
        // Start animation frame
        requestAnimationFrame(this.animate);
        
        // Attach Event Listeners
        this.bindEvents();
    }

    /**
     * Initialize Three.js WebGL Renderer, Scene, Camera, and OrbitControls
     */
    initEngine() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x080c14); // Obsidian backdrop
        this.scene.fog = new THREE.FogExp2(0x080c14, 0.012); // Volumetric gradient fog

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(0, 28, 45); // Ideal strategic overview height

        // Renderer with premium shadows
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Do not go below cockpit floor
        this.controls.minDistance = 15;
        this.controls.maxDistance = 100;
        this.controls.target.set(0, 2, 0);
    }

    /**
     * Configure rich tactical lighting layout
     */
    setupLights() {
        // Sky Ambient Light
        const ambientLight = new THREE.AmbientLight(0x1e293b, 0.85); // soft slate ambient
        this.scene.add(ambientLight);

        // Neon Blue Spot Light over the cockpit center
        const neonSpot = new THREE.SpotLight(0x06b6d4, 4.5, 80, Math.PI / 3, 0.5, 1);
        neonSpot.position.set(0, 35, 0);
        neonSpot.castShadow = true;
        neonSpot.shadow.mapSize.width = 1024;
        neonSpot.shadow.mapSize.height = 1024;
        neonSpot.shadow.bias = -0.001;
        this.scene.add(neonSpot);

        // Neon Green accent light on the left
        const greenAccent = new THREE.DirectionalLight(0x10b981, 0.9);
        greenAccent.position.set(-30, 20, 10);
        this.scene.add(greenAccent);

        // Neon Crimson/Pink accent light on the right
        const redAccent = new THREE.DirectionalLight(0xf43f5e, 0.7);
        redAccent.position.set(30, 20, 10);
        this.scene.add(redAccent);
    }

    /**
     * Rebuild the entire 3D realistic world based on dynamic database records
     */
    rebuildScene(trades, settings, metrics) {
        this.trades = trades;
        this.settings = settings;
        this.metrics = metrics;

        // Clear existing grouped elements & interactive arrays
        this.interactiveObjects = [];
        this.hoveredObject = null;
        if (this.tooltip) this.tooltip.style.display = 'none';

        if (this.calendarGridGroup) this.scene.remove(this.calendarGridGroup);
        if (this.chartsGroup) this.scene.remove(this.chartsGroup);
        if (this.equityGroup) this.scene.remove(this.equityGroup);
        if (this.psychologyGroup) this.scene.remove(this.psychologyGroup);
        if (this.supportOrb) this.scene.remove(this.supportOrb);

        // Construct layout segments
        this.buildPnLCalendarGrid();
        this.buildCandlestickChart();
        this.buildEquityRibbon();
        this.buildPsychologyGauges();
        this.buildSupportOrb();
    }

    /**
     * 1. 3D P&L Calendar Mesh
     * Rendered in the center of the scene as beautiful glass blocks
     */
    buildPnLCalendarGrid() {
        this.calendarGridGroup = new THREE.Group();
        this.scene.add(this.calendarGridGroup);

        const currentMonthTrades = this.filterTradesForCurrentMonth();
        
        // Fetch current month metrics
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayOffset = new Date(year, month, 1).getDay(); // weekday start
        
        // Define calendar grid boundaries
        const cols = 7; // Sun - Sat
        const blockWidth = 2.4;
        const blockDepth = 2.4;
        const spacing = 0.8;
        
        // Calculate max daily profit/loss to scale height cleanly
        let maxDailyPnL = 100; // minimum scaling base
        const dailyTotals = {};
        
        currentMonthTrades.forEach(trade => {
            const date = new Date(trade.date);
            const day = date.getDate();
            dailyTotals[day] = (dailyTotals[day] || 0) + trade.netPnL;
            if (Math.abs(dailyTotals[day]) > maxDailyPnL) {
                maxDailyPnL = Math.abs(dailyTotals[day]);
            }
        });

        // Loop through each calendar slot
        for (let i = 0; i < 42; i++) {
            const dayNumber = i - startDayOffset + 1;
            
            // Grid positions
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = (col - 3) * (blockWidth + spacing);
            const z = (row - 2.5) * (blockDepth + spacing) + 5; // offset slightly forward
            
            // Render calendar grid floor border plate
            const plateGeo = new THREE.BoxGeometry(blockWidth, 0.1, blockDepth);
            const plateMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                roughness: 0.8,
                metalness: 0.2,
                transparent: true,
                opacity: 0.4
            });
            const plateMesh = new THREE.Mesh(plateGeo, plateMat);
            plateMesh.position.set(x, -0.05, z);
            this.calendarGridGroup.add(plateMesh);

            // Render 3D Day block if inside month boundaries
            if (dayNumber > 0 && dayNumber <= daysInMonth) {
                const dayPnL = dailyTotals[dayNumber] || 0;
                
                // Height scaled physically based on net earnings
                let height = 0.3; // flat empty plate base
                let isProfit = dayPnL > 0.01;
                let isLoss = dayPnL < -0.01;
                
                if (isProfit || isLoss) {
                    height = 0.6 + (Math.abs(dayPnL) / maxDailyPnL) * 3.5;
                }

                const geom = new THREE.BoxGeometry(blockWidth, height, blockDepth);
                
                // Premium materials with soft glows and transparencies
                let mat;
                if (isProfit) {
                    // Glowing Neon Emerald Green
                    mat = new THREE.MeshStandardMaterial({
                        color: 0x10b981,
                        emissive: 0x059669,
                        emissiveIntensity: 0.45,
                        roughness: 0.1,
                        metalness: 0.9,
                        transparent: true,
                        opacity: 0.85
                    });
                } else if (isLoss) {
                    // Deep Crimson Quartz Matte
                    mat = new THREE.MeshStandardMaterial({
                        color: 0xf43f5e,
                        emissive: 0xbe123c,
                        emissiveIntensity: 0.3,
                        roughness: 0.3,
                        metalness: 0.4,
                        transparent: true,
                        opacity: 0.85
                    });
                } else {
                    // Breakeven transparent glass panel
                    mat = new THREE.MeshStandardMaterial({
                        color: 0x475569,
                        roughness: 0.05,
                        metalness: 0.95,
                        transparent: true,
                        opacity: 0.3
                    });
                }

                const blockMesh = new THREE.Mesh(geom, mat);
                
                // Position sit block on top of floor plate
                // If profit, sit upward. If loss, sink downward
                const yPos = isLoss ? -height / 2 : height / 2;
                blockMesh.position.set(x, yPos, z);
                blockMesh.castShadow = true;
                blockMesh.receiveShadow = true;
                
                // Embed telemetry data into block metadata for Raycaster
                blockMesh.userData = {
                    type: 'calendarDay',
                    day: dayNumber,
                    pnl: dayPnL,
                    tradesCount: currentMonthTrades.filter(t => new Date(t.date).getDate() === dayNumber).length,
                    originalY: yPos,
                    height: height,
                    isLoss: isLoss
                };

                this.calendarGridGroup.add(blockMesh);
                this.interactiveObjects.push(blockMesh);
            }
        }
    }

    /**
     * 2. 3D Candlestick & Execution Chart
     * Positioned on the left side of the scene
     */
    buildCandlestickChart() {
        this.chartsGroup = new THREE.Group();
        this.chartsGroup.position.set(-22, 0, -8);
        this.scene.add(this.chartsGroup);

        // Base chart panel
        const panelGeo = new THREE.BoxGeometry(16, 0.2, 10);
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.6
        });
        const basePanel = new THREE.Mesh(panelGeo, panelMat);
        basePanel.position.set(0, 0, 0);
        basePanel.receiveShadow = true;
        this.chartsGroup.add(basePanel);

        // Fetch last 8 trades to plot a responsive real-time candlestick sequence
        const plotTrades = this.trades.slice(-8).reverse();
        if (plotTrades.length === 0) return;

        const maxPrice = Math.max(...plotTrades.map(t => Math.max(t.entryPrice || t.entry || 0, t.exitPrice || t.exit || 0)));
        const minPrice = Math.min(...plotTrades.map(t => Math.min(t.entryPrice || t.entry || 0, t.exitPrice || t.exit || 0)));
        const priceRange = (maxPrice - minPrice) || 100;
        
        // Step coordinates along panel width
        const widthStep = 12 / (plotTrades.length || 1);
        const heightScale = 6; // scale bounding box Y coordinates
        
        const coordinateHistory = [];

        plotTrades.forEach((trade, i) => {
            const x = -6 + i * widthStep;
            
            // Normalize prices
            const entryNorm = (((trade.entryPrice || trade.entry || 0) - minPrice) / priceRange) * heightScale + 1;
            const exitNorm = (((trade.exitPrice || trade.exit || 0) - minPrice) / priceRange) * heightScale + 1;
            
            const isBullish = trade.netPnL >= 0;
            const candleTop = Math.max(entryNorm, exitNorm);
            const candleBottom = Math.min(entryNorm, exitNorm);
            const candleHeight = Math.max(0.2, candleTop - candleBottom);
            
            // 3D Glass Candlestick body
            const bodyGeo = new THREE.BoxGeometry(0.8, candleHeight, 0.8);
            let bodyMat;
            
            if (isBullish) {
                // Hollow glowing glass body containing PointLight
                bodyMat = new THREE.MeshStandardMaterial({
                    color: 0x10b981,
                    emissive: 0x059669,
                    emissiveIntensity: 0.35,
                    roughness: 0.15,
                    metalness: 0.85,
                    transparent: true,
                    opacity: 0.8
                });
            } else {
                // Dark smoky quartz column
                bodyMat = new THREE.MeshStandardMaterial({
                    color: 0xf43f5e,
                    emissive: 0x9f1239,
                    emissiveIntensity: 0.25,
                    roughness: 0.4,
                    metalness: 0.3,
                    transparent: true,
                    opacity: 0.8
                });
            }
            
            const candleMesh = new THREE.Mesh(bodyGeo, bodyMat);
            const candleY = candleBottom + candleHeight / 2;
            candleMesh.position.set(x, candleY, 0);
            candleMesh.castShadow = true;
            this.chartsGroup.add(candleMesh);

            // Candle wick wicks
            const wickGeo = new THREE.CylinderGeometry(0.06, 0.06, candleHeight * 1.5, 8);
            const wickMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
            const wickMesh = new THREE.Mesh(wickGeo, wickMat);
            wickMesh.position.set(x, candleY, 0);
            this.chartsGroup.add(wickMesh);

            // Add localized candle point lights for cockpit aesthetic
            const candleLight = new THREE.PointLight(isBullish ? 0x10b981 : 0xf43f5e, 1.2, 6);
            candleLight.position.set(x, candleY, 0);
            this.chartsGroup.add(candleLight);

            // Buy/Sell Arrow Cones (Metallic 3D Tetrahedrons)
            const arrowGeo = new THREE.ConeGeometry(0.4, 0.8, 4);
            let arrowMat, arrowY;
            
            if (trade.direction === 'LONG') {
                // Buy cone point up
                arrowMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });
                arrowY = candleBottom - 0.7;
                const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
                arrowMesh.position.set(x, arrowY, 0);
                this.chartsGroup.add(arrowMesh);
            } else {
                // Sell cone point down
                arrowMat = new THREE.MeshStandardMaterial({ color: 0xec4899, metalness: 0.9, roughness: 0.1 });
                arrowY = candleTop + 0.7;
                const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
                arrowMesh.rotation.x = Math.PI; // point down
                arrowMesh.position.set(x, arrowY, 0);
                this.chartsGroup.add(arrowMesh);
            }

            // Record execution coordinate node for laser connector tracing
            coordinateHistory.push({ x, y: isBullish ? candleBottom : candleTop, trade });

            // Store candle interactive data
            candleMesh.userData = {
                type: 'tradeCandle',
                symbol: trade.symbol,
                direction: trade.direction,
                entry: trade.entryPrice || trade.entry || 0,
                exit: trade.exitPrice || trade.exit || 0,
                pnl: trade.netPnL,
                strategy: trade.strategy,
                emotion: trade.emotion
            };
            this.interactiveObjects.push(candleMesh);
        });

        // 3. Glowing Laser Connection cylinder lines linking sequential executions
        for (let j = 0; j < coordinateHistory.length - 1; j++) {
            const start = coordinateHistory[j];
            const end = coordinateHistory[j + 1];
            
            const startVec = new THREE.Vector3(start.x, start.y, 0);
            const endVec = new THREE.Vector3(end.x, end.y, 0);
            
            const distance = startVec.distanceTo(endVec);
            const laserGeo = new THREE.CylinderGeometry(0.04, 0.04, distance, 8);
            
            // Glowing cyan laser trail material
            const laserMat = new THREE.MeshBasicMaterial({
                color: 0x06b6d4,
                transparent: true,
                opacity: 0.85
            });
            const laserMesh = new THREE.Mesh(laserGeo, laserMat);
            
            // Orient cylinder between coordinates
            const position = endVec.clone().add(startVec).multiplyScalar(0.5);
            laserMesh.position.copy(position);
            
            const direction = endVec.clone().sub(startVec).normalize();
            const upVec = new THREE.Vector3(0, 1, 0);
            laserMesh.quaternion.setFromUnitVectors(upVec, direction);
            
            this.chartsGroup.add(laserMesh);
        }
    }

    /**
     * 3. Translucent 3D Analytics Stack - Equity Spline Ribbon
     * Winding glowing curve representing account balance growth on the right
     */
    buildEquityRibbon() {
        this.equityGroup = new THREE.Group();
        this.equityGroup.position.set(22, 0, -8);
        this.scene.add(this.equityGroup);

        // Base plate
        const baseGeo = new THREE.BoxGeometry(16, 0.2, 10);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.6
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.set(0, 0, 0);
        baseMesh.receiveShadow = true;
        this.equityGroup.add(baseMesh);

        // Extract historical curve values
        const metrics = this.metrics || { equityCurve: [] };
        const rawCurve = metrics.equityCurve || [];
        const curve = rawCurve.map(d => d.balance);
        if (curve.length === 0) {
            curve.push(this.settings.initialCapital || 10000);
        }
        if (curve.length < 2) return;

        const maxBalance = Math.max(...curve);
        const minBalance = Math.min(...curve);
        const balRange = (maxBalance - minBalance) || 1000;
        
        // Generate Spline Curve Points
        const points = [];
        const steps = curve.length;
        const widthStep = 13 / (steps - 1);
        
        for (let i = 0; i < steps; i++) {
            const x = -6.5 + i * widthStep;
            const normY = ((curve[i] - minBalance) / balRange) * 5 + 0.8;
            const z = Math.sin(i * 1.2) * 1.5; // winding serpentine path on Z axis
            points.push(new THREE.Vector3(x, normY, z));
        }

        // Extrude Spline Ribbon Tube
        const pathSpline = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(pathSpline, 64, 0.24, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x0891b2,
            emissiveIntensity: 0.65,
            roughness: 0.05,
            metalness: 0.95
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.castShadow = true;
        this.equityGroup.add(tubeMesh);

        // Render transparent volume grids below the ribbon to form premium volumetric fog plane
        const segmentGeo = new THREE.BoxGeometry(0.1, 5, 0.1);
        const segmentMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending
        });

        points.forEach((p, idx) => {
            if (idx % 2 === 0) { // skip to thin out grids
                const pillar = new THREE.Mesh(segmentGeo, segmentMat);
                pillar.position.set(p.x, p.y / 2, p.z);
                pillar.scale.y = p.y;
                this.equityGroup.add(pillar);
            }
        });
    }

    /**
     * 4. 3D Psychology Cylinder Progress Gauges
     * Positioned in the front left & right background
     */
    buildPsychologyGauges() {
        this.psychologyGroup = new THREE.Group();
        this.psychologyGroup.position.set(0, 0, 16); // front cockpit layout row
        this.scene.add(this.psychologyGroup);

        const metrics = this.metrics || { totalTrades: 0 };
        const trades = this.trades || [];
        
        // Count psychological logs
        let totalCount = trades.length || 1;
        let disciplineCount = 0;
        let fomoCount = 0;
        
        trades.forEach(t => {
            if (t.emotion === 'Disciplined' || t.emotion === 'Patient') disciplineCount++;
            if (t.emotion === 'FOMO' || t.emotion === 'Greedy' || t.mistake === 'FOMO Entry' || t.mistake === 'Revenge Trading') fomoCount++;
        });

        const discPercent = disciplineCount / totalCount;
        const fomoPercent = fomoCount / totalCount;
        
        this.buildSingleGauge(-7, "DISCIPLINE", discPercent, 0x06b6d4); // Blue discipline gauge
        this.buildSingleGauge(7, "FOMO/GREED", fomoPercent, 0xf43f5e);   // Red FOMO caution gauge
    }

    buildSingleGauge(xOffset, labelText, percentage, hexColor) {
        const height = 4.5;
        const radius = 0.9;
        
        // 1. Outer transparent glass tube cylinder
        const outerGeo = new THREE.CylinderGeometry(radius, radius, height, 16);
        const outerMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.05,
            metalness: 0.95,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide
        });
        const outerCylinder = new THREE.Mesh(outerGeo, outerMat);
        outerCylinder.position.set(xOffset, height / 2, 0);
        this.psychologyGroup.add(outerCylinder);

        // Metal base ring cap
        const ringGeo = new THREE.CylinderGeometry(radius + 0.1, radius + 0.1, 0.2, 16);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.15 });
        
        const bottomCap = new THREE.Mesh(ringGeo, ringMat);
        bottomCap.position.set(xOffset, 0.1, 0);
        this.psychologyGroup.add(bottomCap);

        const topCap = new THREE.Mesh(ringGeo, ringMat);
        topCap.position.set(xOffset, height - 0.1, 0);
        this.psychologyGroup.add(topCap);

        // 2. Inner Glowing Liquid mesh adjust Y and height dynamically
        const liquidPercent = Math.max(0.05, Math.min(1.0, percentage || 0.1));
        const liquidHeight = (height - 0.4) * liquidPercent;
        const liquidGeo = new THREE.CylinderGeometry(radius - 0.08, radius - 0.08, liquidHeight, 16);
        
        const liquidMat = new THREE.MeshStandardMaterial({
            color: hexColor,
            emissive: hexColor,
            emissiveIntensity: 0.65,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.75
        });
        
        const liquidCylinder = new THREE.Mesh(liquidGeo, liquidMat);
        
        // Sit liquid cylinder on top of bottom cap
        const liquidY = 0.2 + liquidHeight / 2;
        liquidCylinder.position.set(xOffset, liquidY, 0);
        
        liquidCylinder.userData = {
            type: 'psychologyGauge',
            label: labelText,
            percent: Math.round(liquidPercent * 100)
        };
        
        this.psychologyGroup.add(liquidCylinder);
        this.interactiveObjects.push(liquidCylinder);
    }

    /**
     * 5. Pulsating Support Orb
     * Floating orbital coordinates pan focus to chat console when clicked
     */
    buildSupportOrb() {
        // Positioned high right front cockpit
        const geometry = new THREE.SphereGeometry(1.4, 32, 32);
        
        // Hyper-realistic holographic sphere material with glowing grids
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b5cf6, // electric purple
            emissive: 0x6d28d9,
            emissiveIntensity: 0.85,
            roughness: 0.02,
            metalness: 0.98,
            transparent: true,
            opacity: 0.7
        });

        this.supportOrb = new THREE.Mesh(geometry, material);
        this.supportOrb.position.set(24, 13, 10);
        this.supportOrb.castShadow = true;
        
        this.supportOrb.userData = {
            type: 'supportOrb',
            isOrb: true
        };

        this.scene.add(this.supportOrb);
        this.interactiveObjects.push(this.supportOrb);
        
        // Add orbital PointLight inside Orb
        const orbLight = new THREE.PointLight(0x8b5cf6, 2.5, 12);
        orbLight.position.set(24, 13, 10);
        this.scene.add(orbLight);
    }

    /**
     * Continuous 3D Engine Frame loop
     */
    animate() {
        requestAnimationFrame(this.animate);
        
        const time = Date.now() * 0.001;

        // 1. Orbit Autopilot Sweep orbit calculation
        if (this.autopilot) {
            const speed = 0.15;
            this.camera.position.x = Math.sin(time * speed) * 45;
            this.camera.position.z = Math.cos(time * speed) * 45;
            this.camera.position.y = 22 + Math.sin(time * 0.3) * 6;
            this.camera.lookAt(0, 3, 0);
        } else {
            // Smooth Camera damp updates if manual controls are active
            this.controls.update();
            
            // Subspace mouse tilt parallax
            this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.05;
            this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.05;
            
            this.scene.rotation.x = this.currentRotationX;
            this.scene.rotation.y = this.currentRotationY;
        }

        // 2. Slow Sinusoidal scale pulsing on support orb
        if (this.supportOrb) {
            const scale = 1.0 + Math.sin(time * 2.5) * 0.12;
            this.supportOrb.scale.set(scale, scale, scale);
        }

        // 3. Smooth hovered calendar block rise-slide Y coordinates
        this.interactiveObjects.forEach(obj => {
            if (obj.userData.type === 'calendarDay') {
                const targetY = obj.userData.hovered ? obj.userData.originalY + 1.2 : obj.userData.originalY;
                obj.position.y += (targetY - obj.position.y) * 0.15; // lerp slide
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Map screen coordinates and capture hovered raycast components
     */
    handleMouseMove(event) {
        // Calculate bounds bounding rect relative to main viewport container
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Raycaster intersection check
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveObjects);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            
            if (this.hoveredObject !== hitObject) {
                // Restore old object state
                if (this.hoveredObject && this.hoveredObject.userData.type === 'calendarDay') {
                    this.hoveredObject.userData.hovered = false;
                }
                
                this.hoveredObject = hitObject;
                document.body.style.cursor = 'pointer';
                
                if (this.hoveredObject.userData.type === 'calendarDay') {
                    this.hoveredObject.userData.hovered = true;
                }
            }
            
            // Draw HTML HUD neon tooltip next to cursor
            this.renderTooltip(event, hitObject.userData);
        } else {
            // Restore state if cursor moved off widgets
            if (this.hoveredObject) {
                if (this.hoveredObject.userData.type === 'calendarDay') {
                    this.hoveredObject.userData.hovered = false;
                }
                this.hoveredObject = null;
                document.body.style.cursor = 'default';
                if (this.tooltip) this.tooltip.style.display = 'none';
            }
        }
        
        // Capture parallax target slants if Autopilot is not running
        if (!this.autopilot) {
            this.targetRotationY = this.mouse.x * 0.05;
            this.targetRotationX = -this.mouse.y * 0.05;
        }
    }

    /**
     * Format neon tooltip html content based on component metadata keys
     */
    renderTooltip(event, data) {
        if (!this.tooltip) return;
        
        const rect = this.container.getBoundingClientRect();
        const tooltipX = event.clientX - rect.left + 16;
        const tooltipY = event.clientY - rect.top + 16;
        
        this.tooltip.style.left = `${tooltipX}px`;
        this.tooltip.style.top = `${tooltipY}px`;
        this.tooltip.style.display = 'block';

        // Set dynamic neon border styles
        this.tooltip.className = '';
        
        if (data.type === 'calendarDay') {
            const formattedPnL = this.formatCurrency(data.pnl);
            const isProfit = data.pnl > 0.01;
            const isLoss = data.pnl < -0.01;
            
            this.tooltip.classList.add(isProfit ? 'tooltip-profit' : (isLoss ? 'tooltip-loss' : 'tooltip-neutral'));
            
            this.tooltip.innerHTML = `
                <div class="tooltip-title">
                    <span>📅 DAY ${data.day}</span>
                    <span style="color: ${isProfit ? 'var(--success)' : (isLoss ? 'var(--danger)' : 'var(--text-secondary)')};">
                        ${isProfit ? 'PROFIT 📈' : (isLoss ? 'DRAWDOWN 📉' : 'EMPTY ⚪')}
                    </span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Net Profit:</span>
                    <span class="tooltip-value" style="color: ${isProfit ? 'var(--success)' : (isLoss ? 'var(--danger)' : '#fff')};">${formattedPnL}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Executions:</span>
                    <span class="tooltip-value">${data.tradesCount} logged</span>
                </div>
            `;
        } else if (data.type === 'tradeCandle') {
            const isProfit = data.pnl >= 0;
            const formattedPnL = this.formatCurrency(data.pnl);
            this.tooltip.classList.add(isProfit ? 'tooltip-profit' : 'tooltip-loss');
            
            this.tooltip.innerHTML = `
                <div class="tooltip-title">
                    <span>📊 ${data.symbol} (${data.direction})</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Strategy:</span>
                    <span class="tooltip-value" style="color: var(--cyan);">${data.strategy}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Entry Price:</span>
                    <span class="tooltip-value">${data.entry.toFixed(2)}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Exit Price:</span>
                    <span class="tooltip-value">${data.exit.toFixed(2)}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Net Return:</span>
                    <span class="tooltip-value" style="color: ${isProfit ? 'var(--success)' : 'var(--danger)'};">${formattedPnL}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Mindset:</span>
                    <span class="tooltip-value">${data.emotion}</span>
                </div>
            `;
        } else if (data.type === 'psychologyGauge') {
            this.tooltip.classList.add('tooltip-neutral');
            this.tooltip.innerHTML = `
                <div class="tooltip-title">
                    <span>🧠 PSYCH GAUGING</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Attribute:</span>
                    <span class="tooltip-value" style="color: var(--violet);">${data.label}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Telemetry level:</span>
                    <span class="tooltip-value">${data.percent}%</span>
                </div>
            `;
        } else if (data.isOrb) {
            this.tooltip.classList.add('tooltip-neutral');
            this.tooltip.innerHTML = `
                <div class="tooltip-title">
                    <span>💬 ORBIT SIGNAL</span>
                </div>
                <div class="tooltip-row" style="margin-top: 4px; font-size: 10px; color: var(--text-secondary);">
                    <span>Click orb to establish subspace help link coordinates!</span>
                </div>
            `;
        }
    }

    /**
     * Mouse click event raycasting trigger
     */
    handleMouseClick() {
        if (!this.hoveredObject) return;
        
        if (this.hoveredObject.userData.isOrb) {
            // Smooth Camera Pan to support orb focus coordinates!
            this.panCameraToSupportOrb();
        }
    }

    /**
     * Cinematic pan transition linking support orb coordinates directly to sidebar views
     */
    panCameraToSupportOrb() {
        this.autopilot = false;
        
        // Remove Autopilot toggle if active
        const autopilotBtn = document.getElementById('autopilot-toggle');
        const dashView = document.getElementById('dashboard-view');
        if (autopilotBtn && dashView) {
            autopilotBtn.classList.remove('active-autopilot');
            autopilotBtn.innerHTML = '<span>🛰️</span> <span>AUTOPILOT</span>';
            dashView.classList.remove('cinematic-active');
        }

        // Camera target sweeps coordinates
        const startPos = this.camera.position.clone();
        const endPos = new THREE.Vector3(18, 16, 22);
        
        const startTarget = this.controls.target.clone();
        const endTarget = new THREE.Vector3(24, 13, 10);
        
        const duration = 1200; // ms
        const startTime = performance.now();
        
        const panAnimate = (now) => {
            const progress = Math.min(1.0, (now - startTime) / duration);
            const ease = 1 - Math.pow(1 - progress, 3); // Ease Out Cubic
            
            this.camera.position.lerpVectors(startPos, endPos, ease);
            this.controls.target.lerpVectors(startTarget, endTarget, ease);
            
            if (progress < 1.0) {
                requestAnimationFrame(panAnimate);
            } else {
                // Focus complete! Alert user and scroll support panel
                window.showToast("Subspace coordinates mapped! Opening Quantum Support...", "info");
                setTimeout(() => {
                    // Navigate to Contact section smoothly
                    const contactSection = document.getElementById('landing-contact-pane');
                    if (contactSection) {
                        contactSection.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        // Switch page settings panel migration backups
                        window.switchView('settings');
                    }
                }, 400);
            }
        };
        
        requestAnimationFrame(panAnimate);
    }

    /**
     * Helper calculations to isolate database trades to the current monthly segment
     */
    filterTradesForCurrentMonth() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        return this.trades.filter(trade => {
            const date = new Date(trade.date);
            return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
        });
    }

    /**
     * Currency visual formatting helper
     */
    formatCurrency(value) {
        let symbol = '$';
        if (this.settings.currency === 'INR') symbol = '₹';
        else if (this.settings.currency === 'EUR') symbol = '€';
        else if (this.settings.currency === 'GBP') symbol = '£';
        
        const absolute = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (value < 0 ? '-' : '') + symbol + absolute;
    }

    /**
     * Handle canvas resize adjustments smoothly without texture pixelation stretch
     */
    handleResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Bind listeners
     */
    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', () => this.handleMouseClick());
        
        window.addEventListener('resize', () => this.handleResize());
    }
}
