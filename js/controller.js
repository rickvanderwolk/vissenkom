        let ws = null;
        let isConnected = false;

        // DOM elements
        const connectionStatus = document.getElementById('connectionStatus');
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

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 10;

        function connectWebSocket() {
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
                        setConnectionStatus(false);
                        scheduleReconnect();
                    }
                }, 10000); // 10 second timeout

                ws.onopen = function() {
                    clearTimeout(connectionTimeout);
                    console.log('Mobile Debug: WebSocket connected successfully');
                    reconnectAttempts = 0; // Reset counter on successful connection
                    setConnectionStatus(true);
                    requestStatus();
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
                    setConnectionStatus(false);

                    // Don't reconnect if it was a normal close or access denied
                    if (event.code !== 1000 && event.code !== 1008) {
                        scheduleReconnect();
                    }
                };

                ws.onerror = function(error) {
                    clearTimeout(connectionTimeout);
                    console.error('Mobile Debug: WebSocket error:', error);
                    setConnectionStatus(false);
                };

            } catch (error) {
                console.error('Mobile Debug: Exception creating WebSocket:', error);
                setConnectionStatus(false);
                scheduleReconnect();
            }
        }

        function scheduleReconnect() {
            if (reconnectAttempts >= maxReconnectAttempts) {
                console.error('Mobile Debug: Max reconnection attempts reached');
                showAccessDenied('Verbinding mislukt na meerdere pogingen. Refresh de pagina.');
                return;
            }

            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
            console.log(`Mobile Debug: Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`);

            setTimeout(connectWebSocket, delay);
        }

        function setConnectionStatus(connected) {
            console.log('Mobile Debug: Setting connection status:', connected);

            isConnected = connected;

            // Update UI elements
            if (connectionStatus) {
                connectionStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
                connectionStatus.textContent = `Verbinding: ${connected ? 'Verbonden' : 'Niet verbonden'}`;
                console.log('Mobile Debug: Updated connection status display');
            } else {
                console.error('Mobile Debug: Connection status element not found!');
            }

            // Enable/disable controls based on connection
            const controls = [feedBtn, lightBtn, discoBtn, pumpBtn, cleanBtn, refreshWaterBtn, tapGlassBtn, medicineBtn, addFishBtn, fishNameInput, heatingBtn];
            controls.forEach(control => {
                if (control) {
                    control.disabled = !connected;
                } else {
                    console.warn('Mobile Debug: Control button not found');
                }
            });

            console.log('Mobile Debug: Controls', connected ? 'enabled' : 'disabled');
        }

        function sendCommand(command, data = {}) {
            if (ws && isConnected) {
                ws.send(JSON.stringify({ command, ...data }));
            }
        }

        function requestStatus() {
            sendCommand('getStatus');
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
                case 'version':
                    document.getElementById('versionNumber').textContent = message.version;
                    break;
                case 'config':
                    updateFooter(message.config);
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
        }

        function updateStatus(status) {
            lightStatus.textContent = status.lightsOn ? '💡 Aan' : '🌙 Uit';
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
                temperatureStatus.textContent = `${tempRounded}°C ✅`;
                temperatureStatus.style.color = '#4ecdc4';  // green
            } else if (temp >= 20 && temp <= 28) {
                temperatureStatus.textContent = `${tempRounded}°C ⚠️`;
                temperatureStatus.style.color = '#ffd700';  // yellow
            } else {
                temperatureStatus.textContent = `${tempRounded}°C ❌`;
                temperatureStatus.style.color = '#f44336';  // red
            }

            // Update heating status
            heatingStatus.textContent = status.heatingOn ? '🔥 Aan' : 'Uit';
            heatingStatus.style.color = status.heatingOn ? '#e9f1f7' : '#999';

            // Update button texts
            lightBtn.textContent = status.lightsOn ? '🌙 Licht uit' : '☀️ Licht aan';
            discoBtn.textContent = status.discoOn ? '💡🎉 Disco uit' : '💡🎉 Disco aan';
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
            if (cooldownData.canFeed) {
                feedBtn.disabled = false;
                feedStatus.textContent = '✅ Beschikbaar';
                feedStatus.style.color = '#4ecdc4';
            } else {
                feedBtn.disabled = true;
                // Use better time formatting like the main page
                const timeText = ageLabelMS(cooldownData.timeLeft);
                feedStatus.textContent = `Over ${timeText}`;
                feedStatus.style.color = '#ff9800';
            }
        }

        function updateMedicineStatus(cooldownData) {
            if (cooldownData.canAddMedicine) {
                medicineBtn.disabled = false;
                medicineStatus.textContent = '✅ Beschikbaar';
                medicineStatus.style.color = '#4ecdc4';
            } else {
                medicineBtn.disabled = true;
                // Use better time formatting like the main page
                const timeText = ageLabelMS(cooldownData.timeLeft);
                medicineStatus.textContent = `Over ${timeText}`;
                medicineStatus.style.color = '#ff9800';
            }
        }

        function showAccessDenied(message) {
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

        addFishBtn.addEventListener('click', () => {
            const name = fishNameInput.value.trim();
            if (name) {
                sendCommand('addFish', { name });
                fishNameInput.value = '';
            }
        });

        fishNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addFishBtn.click();
            }
        });

        // Tab switching functionality
        function initTabs() {
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabPanels = document.querySelectorAll('.tab-panel');

            // Restore last active tab from localStorage or default to 'care'
            const savedTab = localStorage.getItem('vissenkom_active_tab') || 'care';
            switchToTab(savedTab);

            // Add click listeners to tab buttons
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');
                    switchToTab(tabName);
                    localStorage.setItem('vissenkom_active_tab', tabName);
                });
            });

            function switchToTab(tabName) {
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
            }
        }

        // Mobile debugging - check DOM elements on startup
        function checkDOMElements() {
            console.log('Mobile Debug: Checking DOM elements...');
            console.log('Mobile Debug: connectionStatus element:', !!connectionStatus);
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

        // Add visibility change listener for mobile app switching
        document.addEventListener('visibilitychange', () => {
            console.log('Mobile Debug: Visibility changed to:', document.visibilityState);
            if (document.visibilityState === 'visible' && !isConnected) {
                console.log('Mobile Debug: App became visible, attempting reconnect');
                connectWebSocket();
            }
        });
