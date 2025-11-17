        let ws = null;
        let isConnected = false;
        let accessDeniedShown = false; // Track if access denied screen is shown

        // Client-side cooldown tracking
        let feedCooldownEndTime = 0;
        let medicineCooldownEndTime = 0;

        // QR code validity tracking
        let accessCodeExpiry = 0;
        let qrValidityCheckInterval = null;

        // Theme names and emojis
        const THEME_INFO = {
            'normal': { name: 'Normaal', emoji: '🐟' },
            'spring': { name: 'Lente', emoji: '🌸' },
            'summer': { name: 'Zomer', emoji: '☀️' },
            'autumn': { name: 'Herfst', emoji: '🍂' },
            'winter': { name: 'Winter', emoji: '❄️' },
            'tropical': { name: 'Tropisch', emoji: '🌴' },
            'arctic': { name: 'Arctisch', emoji: '🧊' },
            'halloween': { name: 'Halloween', emoji: '🎃' },
            'christmas': { name: 'Kerst', emoji: '🎄' }
        };

        // DOM elements
        const feedBtn = document.getElementById('feedBtn');
        const lightBtn = document.getElementById('lightBtn');
        const discoBtn = document.getElementById('discoBtn');
        const pumpBtn = document.getElementById('pumpBtn');
        const cleanBtn = document.getElementById('cleanBtn');
        const refreshWaterBtn = document.getElementById('refreshWaterBtn');
        const tapGlassBtn = document.getElementById('tapGlassBtn');
        const medicineBtn = document.getElementById('medicineBtn');
        const addFishBtn = document.getElementById('addFishBtn');
        const fishNameInput = document.getElementById('fishNameInput');
        const heatingBtn = document.getElementById('heatingBtn');
        const playBallBtn = document.getElementById('playBallBtn');
        // const themeBtn = document.getElementById('themeBtn'); // Tijdelijk uitgeschakeld

        // Status displays
        const lightStatus = document.getElementById('lightStatus');
        const discoStatus = document.getElementById('discoStatus');
        const pumpStatus = document.getElementById('pumpStatus');
        const feedStatus = document.getElementById('feedStatus');
        const waterStatus = document.getElementById('waterStatus');
        const poopStatus = document.getElementById('poopStatus');
        const sickFishStatus = document.getElementById('sickFishStatus');
        const medicineStatus = document.getElementById('medicineStatus');
        const temperatureStatus = document.getElementById('temperatureStatus');
        const heatingStatus = document.getElementById('heatingStatus');
        const fishCountStatus = document.getElementById('fishCountStatus');
        const ballStatus = document.getElementById('ballStatus');
        // const themeStatus = document.getElementById('themeStatus'); // Tijdelijk uitgeschakeld
        const qrValidityStatus = document.getElementById('qrValidityStatus');
        const qrValidityIcon = document.getElementById('qrValidityIcon');
        const qrValidityText = document.getElementById('qrValidityText');


        function connectWebSocket() {
            // Reset access denied flag on new connection attempt
            accessDeniedShown = false;

            // Get access code from URL
            const urlParams = new URLSearchParams(window.location.search);
            const accessCode = urlParams.get('code');

            if (!accessCode) {
                console.error('Mobile Debug: No access code found in URL');
                showAccessDenied('Ongeldige code. Scan de QR code opnieuw.');
                return;
            }

            console.log('Mobile Debug: Starting WebSocket connection with code:', accessCode);

            // Try to connect to websocket server with access code
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const port = window.location.port ? `:${window.location.port}` : '';
            const wsUrl = `${protocol}//${window.location.hostname}${port}/controller?code=${accessCode}`;

            console.log('Mobile Debug: WebSocket URL:', wsUrl);
            console.log('Mobile Debug: User agent:', navigator.userAgent);

            try {
                // Close existing connection if any
                if (ws && ws.readyState !== WebSocket.CLOSED) {
                    ws.close();
                }

                ws = new WebSocket(wsUrl);

                // Set longer timeout for mobile networks
                const connectionTimeout = setTimeout(() => {
                    console.error('Mobile Debug: Connection timeout');
                    if (ws.readyState === WebSocket.CONNECTING) {
                        ws.close();
                        // Only show connection error if access wasn't denied
                        if (!accessDeniedShown) {
                            setConnectionStatus(false);
                            scheduleReconnect();
                        }
                    }
                }, 10000); // 10 second timeout

                ws.onopen = function() {
                    clearTimeout(connectionTimeout);
                    console.log('Mobile Debug: WebSocket connected successfully');
                    setConnectionStatus(true);
                    requestStatus();
                    requestGameState();
                    requestVersion();
                    requestConfig();
                };

                ws.onmessage = function(event) {
                    console.log('Mobile Debug: Received message:', event.data);

                    try {
                        const data = JSON.parse(event.data);

                        // Handle access denied
                        if (data.type === 'accessDenied') {
                            console.error('Mobile Debug: Access denied:', data.message);
                            showAccessDenied(data.message);
                            return;
                        }
                        // Handle access code expiry
                        if (data.error === 'Access code expired') {
                            console.log('Mobile Debug: Access code expired, redirecting to login');
                            showAccessDenied(data.message || 'Your access code has expired. Please enter the new code.');
                            return;
                        }

                        handleMessage(data);
                    } catch (error) {
                        console.error('Mobile Debug: Error parsing message:', error);
                    }
                };

                ws.onclose = function(event) {
                    clearTimeout(connectionTimeout);
                    console.log('Mobile Debug: WebSocket closed. Code:', event.code, 'Reason:', event.reason);

                    // Don't show connection error if access was denied (that screen takes priority)
                    if (!accessDeniedShown) {
                        setConnectionStatus(false);

                        // Don't reconnect if it was a normal close or access denied
                        if (event.code !== 1000 && event.code !== 1008) {
                            scheduleReconnect();
                        }
                    }
                };

                ws.onerror = function(error) {
                    clearTimeout(connectionTimeout);
                    console.error('Mobile Debug: WebSocket error:', error);

                    // Don't show connection error if access was denied (that screen takes priority)
                    if (!accessDeniedShown) {
                        setConnectionStatus(false);
                    }
                };

            } catch (error) {
                console.error('Mobile Debug: Exception creating WebSocket:', error);
                // Only show connection error if access wasn't denied
                if (!accessDeniedShown) {
                    setConnectionStatus(false);
                    scheduleReconnect();
                }
            }
        }

        function scheduleReconnect() {
            // Don't auto-reconnect, just show the error screen
            console.log('Mobile Debug: Connection lost, showing error screen');
            showConnectingScreen();
        }

        function setConnectionStatus(connected) {
            console.log('Mobile Debug: Setting connection status:', connected);

            isConnected = connected;

            // Enable/disable controls based on connection
            const controls = [feedBtn, lightBtn, discoBtn, pumpBtn, cleanBtn, refreshWaterBtn, tapGlassBtn, medicineBtn, addFishBtn, fishNameInput, heatingBtn, playBallBtn]; // themeBtn tijdelijk verwijderd
            controls.forEach(control => {
                if (control) {
                    control.disabled = !connected;
                } else {
                    console.warn('Mobile Debug: Control button not found');
                }
            });

            console.log('Mobile Debug: Controls', connected ? 'enabled' : 'disabled');

            // Show/hide main UI based on connection
            const container = document.querySelector('.controller-container');
            if (container) {
                if (connected) {
                    container.style.display = 'block';
                } else {
                    // Show connecting screen
                    showConnectingScreen();
                }
            }
        }

        function showConnectingScreen() {
            const container = document.querySelector('.controller-container');
            if (!container) return;

            // Hide normal UI
            container.style.display = 'none';

            // Check if connecting screen already exists
            let connectingDiv = document.getElementById('connectingScreen');
            if (!connectingDiv) {
                connectingDiv = document.createElement('div');
                connectingDiv.id = 'connectingScreen';
                connectingDiv.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #eb5757;">
                        <h1>❌ Geen verbinding</h1>
                        <p style="font-size: 18px; margin-bottom: 30px;">Kan geen verbinding maken met de vissenkom.</p>
                        <p style="opacity: 0.8; margin-bottom: 30px;">Controleer of de vissenkom draait of controleer je internetverbinding.</p>
                        <button onclick="location.reload()" style="
                            background: #4ecdc4;
                            color: #0b1e2d;
                            border: none;
                            padding: 15px 30px;
                            font-size: 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: bold;
                        ">🔄 Probeer opnieuw</button>
                    </div>
                `;
                connectingDiv.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #0b1e2d 0%, #083042 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                `;
                document.body.appendChild(connectingDiv);
            } else {
                connectingDiv.style.display = 'flex';
            }
        }

        function sendCommand(command, data = {}) {
            if (ws && isConnected) {
                ws.send(JSON.stringify({ command, ...data }));
            }
        }

        function requestStatus() {
            sendCommand('getStatus');
        }

        function requestGameState() {
            sendCommand('getGameState');
        }

        function requestVersion() {
            sendCommand('getVersion');
        }

        function requestConfig() {
            sendCommand('getConfig');
        }

        function handleMessage(message) {
            switch (message.type) {
                case 'status':
                    updateStatus(message.data);
                    break;
                case 'feedCooldown':
                    updateFeedStatus(message.data);
                    break;
                case 'medicineCooldown':
                    updateMedicineStatus(message.data);
                    break;
                case 'ballStatus':
                    updateBallStatus(message.data);
                    break;
                case 'gameState':
                    updateFishCount(message.data);
                    break;
                case 'version':
                    document.getElementById('versionNumber').textContent = message.version;
                    break;
                case 'config':
                    updateFooter(message.config);
                    break;
                case 'success':
                    showSuccess(message.message);
                    // Switch to home tab after showing success toast
                    setTimeout(() => {
                        if (window.switchToTab) {
                            window.switchToTab('care');
                            localStorage.setItem('vissenkom_active_tab', 'care');
                        }
                    }, 500);
                    break;
                case 'error':
                    showError(message.message);
                    break;
                default:
                    console.log('Onbekend bericht:', message);
            }
        }

        function updateFooter(config) {
            const footerEl = document.getElementById('footerText');
            if (!footerEl) return;

            // Check if footer should be shown (default to true if not specified)
            const showFooter = config.showFooter !== undefined ? config.showFooter : true;

            if (!showFooter) {
                // Hide footer if showFooter is false
                footerEl.style.display = 'none';
                return;
            }

            // Show footer
            footerEl.style.display = 'block';

            if (config.footerLink && config.footerLink.trim() !== '') {
                // Determine link text: use footerLinkText if provided, otherwise use the URL itself
                const linkText = config.footerLinkText && config.footerLinkText.trim() !== ''
                    ? config.footerLinkText
                    : config.footerLink;

                // Create clickable link
                footerEl.innerHTML = `<a href="${config.footerLink}" target="_blank" rel="noopener noreferrer" style="color: #50e3c2; text-decoration: none;">${linkText}</a>`;
            }

            // Update status display visibility
            initStatusDisplay(config);
        }

        function updateStatus(status) {
            lightStatus.textContent = status.lightsOn ? '💡 Aan' : 'Uit';
            lightStatus.style.color = status.lightsOn ? '#e9f1f7' : '#999';

            discoStatus.textContent = status.discoOn ? '🎉 Aan' : 'Uit';
            discoStatus.style.color = status.discoOn ? '#e9f1f7' : '#999';

            pumpStatus.textContent = status.pumpOn ? '💨 Aan' : 'Uit';
            pumpStatus.style.color = status.pumpOn ? '#e9f1f7' : '#999';

            // Update water status
            const greenness = status.waterGreenness || 0;
            const greennessRounded = Math.round(greenness);

            if (greenness < 10) {
                waterStatus.textContent = '✨ Helder';
                waterStatus.style.color = '#4ecdc4';
            } else if (greenness < 25) {
                waterStatus.textContent = `${greennessRounded}% groen`;
                waterStatus.style.color = '#4ecdc4';
            } else if (greenness < 50) {
                waterStatus.textContent = `${greennessRounded}% groen`;
                waterStatus.style.color = '#ffd700';
            } else if (greenness < 75) {
                waterStatus.textContent = `${greennessRounded}% groen`;
                waterStatus.style.color = '#ff9800';
            } else {
                waterStatus.textContent = `${greennessRounded}% groen`;
                waterStatus.style.color = '#f44336';
            }

            // Update poop status
            const poopCount = status.poopCount || 0;
            if (poopCount === 0) {
                poopStatus.textContent = '✨ Schoon';
                poopStatus.style.color = '#4ecdc4';
            } else if (poopCount <= 5) {
                poopStatus.textContent = `${poopCount} 💩`;
                poopStatus.style.color = '#ffd700';
            } else if (poopCount <= 15) {
                poopStatus.textContent = `${poopCount} 💩`;
                poopStatus.style.color = '#ff9800';
            } else {
                poopStatus.textContent = `${poopCount} 💩`;
                poopStatus.style.color = '#f44336';
            }

            // Update sick fish status
            const sickCount = status.sickFishCount || 0;
            if (sickCount === 0) {
                sickFishStatus.textContent = '✅ Geen';
                sickFishStatus.style.color = '#4ecdc4';
            } else if (sickCount === 1) {
                sickFishStatus.textContent = '🦠 1 vis';
                sickFishStatus.style.color = '#ff9800';
            } else {
                sickFishStatus.textContent = `🦠 ${sickCount} vissen`;
                sickFishStatus.style.color = '#f44336';
            }

            // Update temperature status (zonder decimalen)
            const temp = status.temperature || 24;
            const tempRounded = Math.round(temp);

            if (temp >= 22 && temp <= 26) {
                temperatureStatus.textContent = `✅ ${tempRounded}°C`;
                temperatureStatus.style.color = '#4ecdc4';  // green
            } else if (temp >= 20 && temp <= 28) {
                temperatureStatus.textContent = `⚠️ ${tempRounded}°C`;
                temperatureStatus.style.color = '#ffd700';  // yellow
            } else {
                temperatureStatus.textContent = `❌ ${tempRounded}°C`;
                temperatureStatus.style.color = '#f44336';  // red
            }

            // Update heating status
            heatingStatus.textContent = status.heatingOn ? '🔥 Aan' : 'Uit';
            heatingStatus.style.color = status.heatingOn ? '#e9f1f7' : '#999';

            // Update theme status (tijdelijk uitgeschakeld)
            // if (status.theme) {
            //     const themeInfo = THEME_INFO[status.theme] || THEME_INFO['normal'];
            //     themeStatus.textContent = `${themeInfo.emoji} ${themeInfo.name}`;
            //     themeStatus.style.color = '#e9f1f7';
            // }

            // Update QR code validity if expiry time is provided
            if (status.accessCodeExpiry) {
                accessCodeExpiry = status.accessCodeExpiry;
                // Start the validity check if not already running
                if (!qrValidityCheckInterval) {
                    startQRValidityCheck();
                }
            }

            // Update button texts
            lightBtn.textContent = status.lightsOn ? '💡 Licht uit' : '💡 Licht aan';
            discoBtn.textContent = status.discoOn ? '🎉 Disco uit' : '🎉 Disco aan';
            pumpBtn.textContent = status.pumpOn ? '💨 Pomp uit' : '💨 Pomp aan';
            heatingBtn.textContent = status.heatingOn ? '🔥 Verwarming uit' : '🔥 Verwarming aan';

            // Update clean button availability based on poop count
            const hasPoopToClear = status.poopCount && status.poopCount > 0;
            if (isConnected) {
                cleanBtn.disabled = !hasPoopToClear;
                cleanBtn.style.opacity = hasPoopToClear ? '1' : '0.5';

                console.log('Mobile Debug: Clean button', hasPoopToClear ? 'enabled' : 'disabled', 'poop count:', status.poopCount);
            }

            // Update refresh water button availability based on water greenness
            const needsWaterRefresh = greenness > 10;
            if (isConnected) {
                refreshWaterBtn.disabled = !needsWaterRefresh;
                refreshWaterBtn.style.opacity = needsWaterRefresh ? '1' : '0.5';

                console.log('Mobile Debug: Refresh water button', needsWaterRefresh ? 'enabled' : 'disabled', 'greenness:', greenness.toFixed(1) + '%');
            }

            // Update fish count if present in status
            if (status.fishCount !== undefined) {
                fishCountStatus.textContent = `🐟 ${status.fishCount}`;
                fishCountStatus.style.color = '#e9f1f7';
            }
        }

        function ageLabelMS(ms) {
            const s = Math.floor(ms / 1000);
            if (s < 60) return s + 's';
            const m = Math.floor(ms / 60000);
            if (m < 60) return m + 'm';
            const h = Math.floor(ms / 3600000);
            if (h < 24) return h + 'u';
            const d = Math.floor(h / 24);
            if (d < 7) return d + 'd';
            if (d < 30) return Math.floor(d / 7) + 'w';
            const mo = Math.floor(d / 30);
            if (mo < 12) return mo + 'mnd';
            return Math.floor(d / 365) + 'jr';
        }

        function updateFeedStatus(cooldownData) {
            // Set the end time for client-side countdown
            if (cooldownData.canFeed) {
                feedCooldownEndTime = 0; // Clear cooldown
                feedBtn.disabled = false;
                feedStatus.textContent = '✅ Beschikbaar';
                feedStatus.style.color = '#4ecdc4';
            } else {
                // Calculate end time based on lastFed + cooldown duration
                feedCooldownEndTime = cooldownData.lastFed + (60 * 60 * 1000); // 1 hour
                // Initial display will be updated by the countdown timer
                feedBtn.disabled = true;
                const timeText = ageLabelMS(cooldownData.timeLeft);
                feedStatus.textContent = `Kan over ${timeText}`;
                feedStatus.style.color = '#ff9800';
            }
        }

        function updateMedicineStatus(cooldownData) {
            // Set the end time for client-side countdown
            if (cooldownData.canAddMedicine) {
                medicineCooldownEndTime = 0; // Clear cooldown
                medicineBtn.disabled = false;
                medicineStatus.textContent = '✅ Beschikbaar';
                medicineStatus.style.color = '#4ecdc4';
            } else {
                // Calculate end time based on lastMedicine + cooldown duration
                medicineCooldownEndTime = cooldownData.lastMedicine + (24 * 60 * 60 * 1000); // 24 hours
                // Initial display will be updated by the countdown timer
                medicineBtn.disabled = true;
                const timeText = ageLabelMS(cooldownData.timeLeft);
                medicineStatus.textContent = `Kan over ${timeText}`;
                medicineStatus.style.color = '#ff9800';
            }
        }

        function updateBallStatus(statusData) {
            if (statusData.hasBall) {
                // Er is al een bal
                playBallBtn.disabled = true;
                ballStatus.textContent = '🎾 Bal aanwezig';
                ballStatus.style.color = '#ff9800';
            } else {
                // Geen bal, button beschikbaar
                playBallBtn.disabled = false;
                ballStatus.textContent = '✅ Beschikbaar';
                ballStatus.style.color = '#4ecdc4';
            }
        }

        function updateFishCount(gameData) {
            if (gameData && gameData.fishes) {
                const fishCount = gameData.fishes.length;
                fishCountStatus.textContent = `🐟 ${fishCount}`;
                fishCountStatus.style.color = '#e9f1f7';
            }
        }

        function updateQRValidity() {
            const now = Date.now();
            const timeRemaining = accessCodeExpiry - now;

            // Remove all classes
            qrValidityStatus.classList.remove('valid', 'expiring', 'expired');

            if (timeRemaining <= 0) {
                // Expired
                qrValidityStatus.classList.add('expired');
                qrValidityIcon.textContent = '🔒';
                qrValidityText.textContent = 'verlopen';
            } else if (timeRemaining < 10 * 60 * 1000) {
                // Less than 10 minutes remaining - expiring soon
                const minutesLeft = Math.floor(timeRemaining / 60000);
                qrValidityStatus.classList.add('expiring');
                qrValidityIcon.textContent = '🔓';
                qrValidityText.textContent = `nog ${minutesLeft} min`;
            } else {
                // Valid - show full time remaining
                const minutesLeft = Math.floor(timeRemaining / 60000);
                qrValidityStatus.classList.add('valid');
                qrValidityIcon.textContent = '🔓';
                qrValidityText.textContent = `nog ${minutesLeft} min`;
            }
        }

        function startQRValidityCheck() {
            // Clear any existing interval
            if (qrValidityCheckInterval) {
                clearInterval(qrValidityCheckInterval);
            }

            // Update immediately
            updateQRValidity();

            // Update every 30 seconds
            qrValidityCheckInterval = setInterval(updateQRValidity, 30000);
        }

        function showAccessDenied(message) {
            // Set flag to prevent connection error screens from overriding this
            accessDeniedShown = true;

            // Hide all controls
            document.querySelector('.controller-container').style.display = 'none';

            // Show access denied message
            const deniedDiv = document.createElement('div');
            deniedDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #eb5757;">
                    <h1>🚫 Ongeldige Code</h1>
                    <p style="font-size: 18px; margin-bottom: 30px;">${message}</p>
                    <p style="opacity: 0.8;">Ga terug naar de vissenkom en scan de QR code opnieuw voor een nieuwe toegangscode.</p>
                </div>
            `;
            deniedDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #0b1e2d 0%, #083042 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            document.body.appendChild(deniedDiv);
        }

        function showError(message) {
            // Create error toast
            const errorDiv = document.createElement('div');
            errorDiv.textContent = message;
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #eb5757;
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-size: 16px;
                font-weight: 500;
                max-width: 90%;
                text-align: center;
                animation: slideDown 0.3s ease-out;
            `;

            document.body.appendChild(errorDiv);

            // Remove after 4 seconds
            setTimeout(() => {
                errorDiv.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(() => errorDiv.remove(), 300);
            }, 4000);
        }

        function showSuccess(message) {
            // Create success toast
            const successDiv = document.createElement('div');
            successDiv.textContent = message;
            successDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #3ecf5c, #2db84b);
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(62, 207, 92, 0.4);
                z-index: 10000;
                font-size: 16px;
                font-weight: 500;
                max-width: 90%;
                text-align: center;
                animation: slideDown 0.3s ease-out;
            `;

            document.body.appendChild(successDiv);

            // Remove after 3 seconds
            setTimeout(() => {
                successDiv.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(() => successDiv.remove(), 300);
            }, 3000);
        }

        // Event listeners
        feedBtn.addEventListener('click', () => sendCommand('feed'));
        lightBtn.addEventListener('click', () => sendCommand('toggleLight'));
        discoBtn.addEventListener('click', () => sendCommand('toggleDisco'));
        pumpBtn.addEventListener('click', () => sendCommand('togglePump'));
        cleanBtn.addEventListener('click', () => sendCommand('cleanTank'));
        refreshWaterBtn.addEventListener('click', () => sendCommand('refreshWater'));
        tapGlassBtn.addEventListener('click', () => sendCommand('tapGlass'));
        medicineBtn.addEventListener('click', () => sendCommand('addMedicine'));
        heatingBtn.addEventListener('click', () => sendCommand('toggleHeating'));
        playBallBtn.addEventListener('click', () => sendCommand('addPlayBall'));
        // themeBtn.addEventListener('click', () => sendCommand('cycleTheme')); // Tijdelijk uitgeschakeld

        addFishBtn.addEventListener('click', () => {
            const name = fishNameInput.value.trim();
            if (name) {
                sendCommand('addFish', { name });
                fishNameInput.value = '';
                // Auto-redirect happens in success message handler
            }
        });

        fishNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addFishBtn.click();
            }
        });

        // Status display visibility
        function initStatusDisplay(config) {
            // Default to true if not specified
            const showStatus = config && config.showControllerStatusBlocks !== undefined ? config.showControllerStatusBlocks : true;

            const statusDisplays = document.querySelectorAll('.tab-status-display');
            statusDisplays.forEach(display => {
                display.style.display = showStatus ? 'grid' : 'none';
            });
        }

        // Tab switching functionality
        function initTabs() {
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabPanels = document.querySelectorAll('.tab-panel');

            // Make switchToTab globally accessible
            window.switchToTab = function(tabName) {
                // Update tab buttons
                tabButtons.forEach(btn => {
                    if (btn.getAttribute('data-tab') === tabName) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                // Update tab panels
                tabPanels.forEach(panel => {
                    if (panel.getAttribute('data-panel') === tabName) {
                        panel.classList.add('active');
                    } else {
                        panel.classList.remove('active');
                    }
                });
            };

            // Restore last active tab from localStorage or default to 'care'
            const savedTab = localStorage.getItem('vissenkom_active_tab') || 'care';
            window.switchToTab(savedTab);

            // Add click listeners to tab buttons
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');
                    window.switchToTab(tabName);
                    localStorage.setItem('vissenkom_active_tab', tabName);
                });
            });

            // Add click listener to fish hint link
            const fishTabLink = document.getElementById('fishTabLink');
            if (fishTabLink) {
                fishTabLink.addEventListener('click', () => {
                    window.switchToTab('fish');
                    localStorage.setItem('vissenkom_active_tab', 'fish');
                });
            }
        }

        // Mobile debugging - check DOM elements on startup
        function checkDOMElements() {
            console.log('Mobile Debug: Checking DOM elements...');
            console.log('Mobile Debug: h1 element:', !!document.querySelector('h1'));
            console.log('Mobile Debug: controller-container:', !!document.querySelector('.controller-container'));
            console.log('Mobile Debug: feedBtn:', !!feedBtn);
            console.log('Mobile Debug: lightBtn:', !!lightBtn);
            console.log('Mobile Debug: Window size:', window.innerWidth, 'x', window.innerHeight);
            console.log('Mobile Debug: Device pixel ratio:', window.devicePixelRatio);
            console.log('Mobile Debug: Network:', navigator.onLine ? 'online' : 'offline');

            // Check if CSS is loaded
            const testElement = document.querySelector('.controller-container');
            if (testElement) {
                const computedStyle = window.getComputedStyle(testElement);
                console.log('Mobile Debug: CSS loaded (background):', computedStyle.background !== '');
                console.log('Mobile Debug: CSS loaded (padding):', computedStyle.padding);
            }
        }

        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('Mobile Debug: DOM loaded');
                checkDOMElements();
                initTabs();
                connectWebSocket();
            });
        } else {
            console.log('Mobile Debug: DOM already loaded');
            checkDOMElements();
            initTabs();
            connectWebSocket();
        }

        // Request status updates every 5 seconds for better performance
        setInterval(() => {
            if (isConnected) {
                requestStatus();
            }
        }, 5000);

        // Client-side countdown timers for smooth UI (100ms updates)
        setInterval(() => {
            // Feed cooldown countdown
            if (feedCooldownEndTime > 0) {
                const now = Date.now();
                const timeLeft = Math.max(0, feedCooldownEndTime - now);

                if (timeLeft > 0) {
                    feedBtn.disabled = true;
                    const timeText = ageLabelMS(timeLeft);
                    feedStatus.textContent = `Kan over ${timeText}`;
                    feedStatus.style.color = '#ff9800';
                } else {
                    // Cooldown ended
                    feedCooldownEndTime = 0;
                    feedBtn.disabled = false;
                    feedStatus.textContent = '✅ Beschikbaar';
                    feedStatus.style.color = '#4ecdc4';
                }
            }

            // Medicine cooldown countdown
            if (medicineCooldownEndTime > 0) {
                const now = Date.now();
                const timeLeft = Math.max(0, medicineCooldownEndTime - now);

                if (timeLeft > 0) {
                    medicineBtn.disabled = true;
                    const timeText = ageLabelMS(timeLeft);
                    medicineStatus.textContent = `Kan over ${timeText}`;
                    medicineStatus.style.color = '#ff9800';
                } else {
                    // Cooldown ended
                    medicineCooldownEndTime = 0;
                    medicineBtn.disabled = false;
                    medicineStatus.textContent = '✅ Beschikbaar';
                    medicineStatus.style.color = '#4ecdc4';
                }
            }
        }, 100); // Update every 100ms for smooth countdown

        // Add visibility change listener for mobile app switching
        document.addEventListener('visibilitychange', () => {
            console.log('Mobile Debug: Visibility changed to:', document.visibilityState);
            if (document.visibilityState === 'visible' && !isConnected) {
                console.log('Mobile Debug: App became visible, attempting reconnect');
                connectWebSocket();
            }
        });
