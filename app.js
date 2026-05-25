/* ==========================================================================
   GeoMind Reminders - Interactive Logic & Geofence Simulation Engine
   ========================================================================== */

// --- Default Mock Center (Manhattan NYC - Vibrant Urban Sandbox) ---
const MAP_DEFAULT_CENTER = [40.7580, -73.9855]; // Times Square
const PRESETS = {
    office: [40.7528, -73.9723],   // Grand Central / Office area
    market: [40.7359, -73.9911],   // Union Square Hardware / Shopping area
    park: [40.7829, -73.9654],     // Central Park recreational area
    timesSquare: [40.7580, -73.9855] // Default Times Square center
};

// --- Application State ---
let state = {
    tasks: [],
    userLocation: {
        lat: MAP_DEFAULT_CENTER[0],
        lng: MAP_DEFAULT_CENTER[1]
    },
    activeTab: 'all',
    searchQuery: '',
    filterPriority: 'all',
    dragModeActive: true,
    liveTrackingActive: false,
    watchId: null
};

// --- Map Assets & Elements ---
let map;
let userMarker;
let taskMapObjects = {}; // Maps taskId -> { marker, circle }

// --- DOM Elements ---
const dom = {
    mapContainer: document.getElementById('map'),
    gpsStatusText: document.getElementById('status-text'),
    gpsStatusDot: document.getElementById('status-dot'),
    
    // Controls
    btnLiveGps: document.getElementById('btn-live-gps'),
    btnSimulateCurrent: document.getElementById('btn-simulate-current'),
    btnModeDrag: document.getElementById('btn-mode-drag'),
    btnPresetOffice: document.getElementById('btn-preset-office'),
    btnPresetMarket: document.getElementById('btn-preset-market'),
    btnPresetPark: document.getElementById('btn-preset-park'),
    
    // Metrics
    metricTotal: document.getElementById('metric-total'),
    metricTriggered: document.getElementById('metric-triggered'),
    metricHigh: document.getElementById('metric-high'),
    
    // Task panel
    tabAll: document.getElementById('tab-all'),
    tabPending: document.getElementById('tab-pending'),
    tabTriggered: document.getElementById('tab-triggered'),
    searchBar: document.getElementById('search-bar'),
    filterPriority: document.getElementById('filter-priority'),
    tasksListContainer: document.getElementById('tasks-list-container'),
    btnAddReminder: document.getElementById('btn-add-reminder'),
    
    // Modal
    modalReminder: document.getElementById('modal-reminder'),
    modalTitleText: document.getElementById('modal-title-text'),
    formReminder: document.getElementById('form-reminder'),
    btnCancelForm: document.getElementById('btn-cancel-form'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    
    // Form Inputs
    taskTitle: document.getElementById('task-title'),
    taskDesc: document.getElementById('task-desc'),
    taskLat: document.getElementById('task-lat'),
    taskLng: document.getElementById('task-lng'),
    taskRadius: document.getElementById('task-radius'),
    taskPriority: document.getElementById('task-priority'),
    taskDeadline: document.getElementById('task-deadline'),
    taskVoice: document.getElementById('task-voice'),
    
    // Toast Container
    toastHolder: document.getElementById('toast-holder')
};

// --- Initializing App ---
window.addEventListener('DOMContentLoaded', () => {
    loadStateFromStorage();
    initLeafletMap();
    setupDefaultRemindersIfEmpty();
    bindEventListeners();
    updateMetrics();
    renderTasksList();
    runGeofenceVerification();
});

// --- Local Storage Management ---
function loadStateFromStorage() {
    const saved = localStorage.getItem('geomind_tasks');
    if (saved) {
        try {
            state.tasks = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse stored tasks:", e);
            state.tasks = [];
        }
    }
}

function saveStateToStorage() {
    localStorage.setItem('geomind_tasks', JSON.stringify(state.tasks));
}

// Set up gorgeous mock markers to demonstrate proximity on first load
function setupDefaultRemindersIfEmpty() {
    if (state.tasks.length === 0) {
        state.tasks = [
            {
                id: 'mock-1',
                title: 'Purchase bolts & insulation tape',
                desc: 'Hardware Store - Main aisle tools section. Get 3/8 inch sizes.',
                lat: PRESETS.market[0],
                lng: PRESETS.market[1],
                radius: 250,
                priority: 'high',
                deadline: '',
                voiceEnabled: true,
                triggered: false,
                completed: false
            },
            {
                id: 'mock-2',
                title: 'Collect monthly report from board',
                desc: 'Head office - Level 4 reception desk. Ask Sarah.',
                lat: PRESETS.office[0],
                lng: PRESETS.office[1],
                radius: 180,
                priority: 'medium',
                deadline: '',
                voiceEnabled: true,
                triggered: false,
                completed: false
            },
            {
                id: 'mock-3',
                title: 'Evening jogging session & stretch',
                desc: 'Central Park track. Stretch for 10 mins near Sheep Meadow.',
                lat: PRESETS.park[0],
                lng: PRESETS.park[1],
                radius: 300,
                priority: 'low',
                deadline: '',
                voiceEnabled: false,
                triggered: false,
                completed: false
            }
        ];
        saveStateToStorage();
    }
}

// --- Map setup ---
function initLeafletMap() {
    // Creating the map container with smooth scroll zooms
    map = L.map('map', {
        zoomControl: true,
        doubleClickZoom: false // Double-click used for setting task!
    }).setView(MAP_DEFAULT_CENTER, 14);

    // Apply CartoDB Dark Matter tile layer for premium dark appearance
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Create the simulated User Avatar marker (Teal pulsing custom element)
    const userIcon = L.divIcon({
        className: 'user-marker-icon',
        html: '<div class="user-marker-pulse"></div><div class="user-marker-pin"></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    userMarker = L.marker(MAP_DEFAULT_CENTER, {
        icon: userIcon,
        draggable: state.dragModeActive,
        zIndexOffset: 1000
    }).addTo(map);

    // Setup marker drag event handlers
    userMarker.on('drag', (e) => {
        const position = userMarker.getLatLng();
        state.userLocation.lat = position.lat;
        state.userLocation.lng = position.lng;
        runGeofenceVerification();
    });

    userMarker.on('dragend', () => {
        // Center slightly to smooth focus
        showToast("GPS Relocated", `Mock coordinate set to: ${state.userLocation.lat.toFixed(4)}, ${state.userLocation.lng.toFixed(4)}`, "cyan");
    });

    // Handle map double click to add reminder
    map.on('dblclick', (e) => {
        openAddReminderModal(e.latlng.lat, e.latlng.lng);
    });

    // Populate the Leaflet map with tasks markers/circles
    refreshMapTaskLayers();
}

function refreshMapTaskLayers() {
    // Clear old map layers
    Object.keys(taskMapObjects).forEach(id => {
        const layers = taskMapObjects[id];
        if (layers.marker) map.removeLayer(layers.marker);
        if (layers.circle) map.removeLayer(layers.circle);
    });
    taskMapObjects = {};

    // Draw active task circles
    state.tasks.forEach(task => {
        if (task.completed) return; // Don't draw completed tasks on simulation map

        // Priority colors mapping
        let color = '#00f0ff'; // low (cyan)
        if (task.priority === 'medium') color = '#8a2be2'; // purple
        if (task.priority === 'high') color = '#ff1e64'; // rose
        if (task.triggered) color = '#00e673'; // emerald when active/triggered

        // Create Task geofence boundary circle overlay
        const circle = L.circle([task.lat, task.lng], {
            radius: task.radius,
            color: color,
            fillColor: color,
            fillOpacity: task.triggered ? 0.12 : 0.04,
            weight: task.triggered ? 2.5 : 1.2,
            dashArray: task.triggered ? null : '4, 4'
        }).addTo(map);

        // Task Pin Marker
        const markerIcon = L.divIcon({
            className: 'custom-task-pin',
            html: `<div style="
                background-color: ${color}; 
                width: 12px; 
                height: 12px; 
                border-radius: 50%; 
                border: 2px solid #fff;
                box-shadow: 0 0 10px ${color};
            "></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        const marker = L.marker([task.lat, task.lng], {
            icon: markerIcon
        }).addTo(map);

        // Bind interactive Leaflet popup
        marker.bindPopup(`
            <div style="color: #fff; font-family: 'Inter', sans-serif; padding: 2px;">
                <h4 style="margin: 0 0 4px 0; font-family: 'Outfit'; color: ${color};">${task.title}</h4>
                <p style="margin: 0 0 6px 0; font-size: 0.8rem; color: #ccc;">${task.desc || 'No description'}</p>
                <div style="font-size: 0.75rem; font-weight: 500;">Geofence: <strong>${task.radius}m</strong></div>
            </div>
        `);

        taskMapObjects[task.id] = { marker, circle };
    });
}

// --- Geofencing Proximity Algorithm ---
function runGeofenceVerification() {
    let activeAlertCount = 0;
    
    state.tasks.forEach(task => {
        if (task.completed) return;

        // Calculate proximity distance using Haversine formula
        const dist = calculateDistance(
            state.userLocation.lat,
            state.userLocation.lng,
            task.lat,
            task.lng
        );

        // Update active distance info on rendered task cards (if visible)
        const distanceEl = document.getElementById(`dist-${task.id}`);
        if (distanceEl) {
            distanceEl.textContent = `${Math.round(dist)}m away`;
        }

        // Trigger detection
        if (dist <= task.radius) {
            activeAlertCount++;
            
            if (!task.triggered) {
                // Task entered geofence boundary!
                task.triggered = true;
                saveStateToStorage();
                
                // Trigger Toast visual alert
                showProximityAlertToast(task);
                
                // Play futuristic audio beacon sound
                playNotificationSound();
                
                // Execute Text-To-Speech announcement if enabled
                if (task.voiceEnabled) {
                    speakVoiceReminder(task);
                }

                // Refresh DOM and Map circles visually
                refreshMapTaskLayers();
                renderTasksList();
                updateMetrics();
            }
        } else {
            // Optional: reset triggering if user leaves the geofence area.
            // In a real application, you might want geofences to remain marked as "Triggered"
            // until completed to prevent voice spamming. We will keep it triggered
            // to represent a "Triggered state" that can be checked off.
        }
    });

    // Update GPS beacon radar panel
    if (activeAlertCount > 0) {
        dom.gpsStatusDot.className = "status-dot active";
        dom.gpsStatusText.textContent = `Proximity Alert: ${activeAlertCount} active!`;
        dom.gpsStatusText.style.color = "var(--accent-emerald)";
    } else {
        dom.gpsStatusDot.className = "status-dot";
        dom.gpsStatusText.textContent = "Radar scanning... Location secure";
        dom.gpsStatusText.style.color = "var(--text-secondary)";
    }
}

// --- Proximity Math: Haversine Formula ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Returns distance in meters
}

// --- Synthesized Notification Audio Context (Browser Web Audio) ---
function playNotificationSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        
        // Fast dual electronic synth beep
        const playBeep = (freq, time, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(time);
            osc.stop(time + duration);
        };

        // Futuristic ascending beep sequence
        playBeep(587.33, ctx.currentTime, 0.15); // D5
        playBeep(880.00, ctx.currentTime + 0.12, 0.25); // A5
    } catch (err) {
        console.warn("Audio Context playback failed or blocked by user gesture:", err);
    }
}

// --- Web Speech API Text-to-Speech Core ---
function speakVoiceReminder(task) {
    if ('speechSynthesis' in window) {
        // Cancel ongoing voices to avoid collision
        window.speechSynthesis.cancel();

        const spokenText = `Smart Alert: You are approaching ${task.title}. ${task.desc ? task.desc : ''}`;
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.rate = 1.0;
        utterance.pitch = 1.1; // Make it sound bright and friendly
        
        // Pick an English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => voice.lang.startsWith('en') && voice.name.includes('Google'));
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }
}

// --- UI Alerts & Toast notifications ---
function showToast(title, message, accentColor = 'cyan') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let colorHex = 'var(--accent-cyan)';
    let iconClass = 'fa-circle-info';
    
    if (accentColor === 'rose') {
        colorHex = 'var(--accent-rose)';
        iconClass = 'fa-triangle-exclamation';
    } else if (accentColor === 'emerald') {
        colorHex = 'var(--accent-emerald)';
        iconClass = 'fa-location-dot';
    } else if (accentColor === 'purple') {
        colorHex = 'var(--accent-purple)';
        iconClass = 'fa-bullhorn';
    }

    toast.style.borderColor = colorHex;
    toast.style.boxShadow = `0 10px 30px rgba(0,0,0,0.3), 0 0 10px ${colorHex}33`;

    toast.innerHTML = `
        <div class="toast-icon" style="color: ${colorHex};">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title" style="color: ${colorHex};">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    dom.toastHolder.appendChild(toast);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.add('toast-remove');
        setTimeout(() => {
            if (dom.toastHolder.contains(toast)) {
                dom.toastHolder.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

function showProximityAlertToast(task) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderColor = 'var(--accent-emerald)';
    toast.style.boxShadow = '0 10px 35px rgba(0, 230, 115, 0.25)';

    toast.innerHTML = `
        <div class="toast-icon" style="color: var(--accent-emerald);">
            <i class="fa-solid fa-bell animate-bounce"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title" style="color: var(--accent-emerald); font-weight: 800;">
                <i class="fa-solid fa-street-view"></i> GEOFENCE TRIGGERED!
            </div>
            <div class="toast-title" style="font-size: 0.95rem; margin-top: 4px;">${task.title}</div>
            <div class="toast-message">${task.desc || 'No description provided'}</div>
            <div style="font-size: 0.72rem; color: var(--accent-emerald); font-weight: bold; margin-top: 6px;">
                Radius: ${task.radius}m | Proximity active
            </div>
        </div>
    `;

    dom.toastHolder.appendChild(toast);

    // Leave geofence notifications slightly longer
    setTimeout(() => {
        toast.classList.add('toast-remove');
        setTimeout(() => {
            if (dom.toastHolder.contains(toast)) {
                dom.toastHolder.removeChild(toast);
            }
        }, 300);
    }, 6000);
}

// --- Metrics updates ---
function updateMetrics() {
    const total = state.tasks.length;
    const triggered = state.tasks.filter(t => t.triggered && !t.completed).length;
    const highPriority = state.tasks.filter(t => t.priority === 'high' && !t.completed).length;

    dom.metricTotal.textContent = total;
    dom.metricTriggered.textContent = triggered;
    dom.metricHigh.textContent = highPriority;
}

// --- List Render Pipeline ---
function renderTasksList() {
    dom.tasksListContainer.innerHTML = '';
    
    // Filter & Search criteria
    const filteredTasks = state.tasks.filter(task => {
        // 1. Search Query Filter
        const matchesSearch = task.title.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                              task.desc.toLowerCase().includes(state.searchQuery.toLowerCase());
        
        // 2. Priority Level Filter
        const matchesPriority = state.filterPriority === 'all' || task.priority === state.filterPriority;
        
        // 3. Tab Categorization Filter
        let matchesTab = true;
        if (state.activeTab === 'pending') {
            matchesTab = !task.completed;
        } else if (state.activeTab === 'triggered') {
            matchesTab = task.triggered && !task.completed;
        }

        return matchesSearch && matchesPriority && matchesTab;
    });

    if (filteredTasks.length === 0) {
        dom.tasksListContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-list-check"></i>
                <p>No matching reminders found.<br>Try adjusting your search queries or category filters!</p>
            </div>
        `;
        return;
    }

    filteredTasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = `task-card ${task.triggered && !task.completed ? 'active-trigger' : ''} ${task.completed ? 'completed' : ''}`;
        
        // Distance helper text (initial state or lazy computed)
        const dist = calculateDistance(state.userLocation.lat, state.userLocation.lng, task.lat, task.lng);
        const distText = `${Math.round(dist)}m away`;

        // Format dates
        let deadlineMarkup = '';
        if (task.deadline) {
            const date = new Date(task.deadline);
            deadlineMarkup = `<span><i class="fa-regular fa-clock"></i> Due: ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
        }

        taskCard.innerHTML = `
            <div class="task-header">
                <div class="task-title-group">
                    <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTaskCompletion('${task.id}')">
                        ${task.completed ? '<i class="fa-solid fa-check"></i>' : ''}
                    </div>
                    <span class="task-title">${task.title}</span>
                </div>
                <div class="task-badges">
                    <span class="badge priority-${task.priority}">${task.priority}</span>
                    ${task.triggered && !task.completed ? '<span class="badge triggered-tag"><i class="fa-solid fa-wave-square"></i> Near</span>' : ''}
                </div>
            </div>

            ${task.desc ? `<p class="task-description">${task.desc}</p>` : ''}

            <div class="task-footer">
                <div class="task-location-info" onclick="focusTaskOnMap('${task.id}')" title="Zoom & center map on this task">
                    <i class="fa-solid fa-location-crosshairs" style="color: var(--accent-cyan);"></i>
                    <span id="dist-${task.id}">${distText}</span>
                    <span style="color: var(--text-muted); font-size: 0.7rem;">(${task.lat.toFixed(4)}, ${task.lng.toFixed(4)})</span>
                </div>
                
                <div class="task-actions">
                    ${task.voiceEnabled ? '<span class="voice-indicator" title="Voice Alerts Active"><i class="fa-solid fa-volume-high"></i></span>' : ''}
                    <button class="action-btn navigate-btn" onclick="navigateToTask('${task.id}')" title="Navigate in Google Maps">
                        <i class="fa-solid fa-compass" style="color: var(--accent-purple);"></i>
                    </button>
                    <button class="action-btn focus-btn" onclick="focusTaskOnMap('${task.id}')" title="Show on Map">
                        <i class="fa-solid fa-map"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteTask('${task.id}')" title="Delete Task">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;

        dom.tasksListContainer.appendChild(taskCard);
    });
}

// --- Interactive Controller Actions ---

window.toggleTaskCompletion = function(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        
        // Reset triggered state if uncompleted so it can re-trigger
        if (!task.completed) {
            task.triggered = false;
        }

        saveStateToStorage();
        updateMetrics();
        refreshMapTaskLayers();
        renderTasksList();
        runGeofenceVerification();

        const completionMsg = task.completed ? "Reminder Completed!" : "Reminder Restored to Pending";
        showToast(completionMsg, `"${task.title}" has been updated.`, task.completed ? "emerald" : "cyan");
    }
};

window.deleteTask = function(taskId) {
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        const deletedTitle = state.tasks[index].title;
        state.tasks.splice(index, 1);
        
        saveStateToStorage();
        updateMetrics();
        refreshMapTaskLayers();
        renderTasksList();
        runGeofenceVerification();

        showToast("Reminder Deleted", `"${deletedTitle}" removed from systems.`, "rose");
    }
};

window.focusTaskOnMap = function(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        map.setView([task.lat, task.lng], 16, {
            animate: true,
            duration: 1.0
        });

        // Highlight marker if it exists
        if (taskMapObjects[task.id] && taskMapObjects[task.id].marker) {
            taskMapObjects[task.id].marker.openPopup();
        }

        showToast("Map Panned", `Centered on: ${task.title}`, "cyan");
    }
};

window.navigateToTask = function(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        const origin = `${state.userLocation.lat},${state.userLocation.lng}`;
        const destination = `${task.lat},${task.lng}`;
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
        
        window.open(googleMapsUrl, '_blank');
        
        const locType = state.liveTrackingActive ? "live GPS" : "simulated";
        showToast("Opening Google Maps", `Routing from your ${locType} position to "${task.title}".`, "purple");
    }
};

// --- Modal Control Functions ---
function openAddReminderModal(lat = null, lng = null) {
    // Fill coordinates from custom inputs or default user markers
    if (lat !== null && lng !== null) {
        dom.taskLat.value = lat.toFixed(6);
        dom.taskLng.value = lng.toFixed(6);
    } else {
        dom.taskLat.value = state.userLocation.lat.toFixed(6);
        dom.taskLng.value = state.userLocation.lng.toFixed(6);
    }

    // Clear rest of inputs
    dom.taskTitle.value = '';
    dom.taskDesc.value = '';
    dom.taskRadius.value = 200;
    dom.taskPriority.value = 'medium';
    dom.taskDeadline.value = '';
    dom.taskVoice.checked = true;

    dom.modalReminder.classList.add('active');
    dom.taskTitle.focus();
}

function closeAddReminderModal() {
    dom.modalReminder.classList.remove('active');
}

// --- Bind Event Listeners ---
function bindEventListeners() {
    // Open/Close Modal
    dom.btnAddReminder.addEventListener('click', () => openAddReminderModal());
    dom.btnCloseModal.addEventListener('click', closeAddReminderModal);
    dom.btnCancelForm.addEventListener('click', closeAddReminderModal);

    // Save reminder form submit
    dom.formReminder.addEventListener('submit', (e) => {
        e.preventDefault();

        const newTask = {
            id: 'task-' + Date.now(),
            title: dom.taskTitle.value.trim(),
            desc: dom.taskDesc.value.trim(),
            lat: parseFloat(dom.taskLat.value),
            lng: parseFloat(dom.taskLng.value),
            radius: parseInt(dom.taskRadius.value),
            priority: dom.taskPriority.value,
            deadline: dom.taskDeadline.value,
            voiceEnabled: dom.taskVoice.checked,
            triggered: false,
            completed: false
        };

        state.tasks.unshift(newTask);
        saveStateToStorage();
        
        closeAddReminderModal();
        
        // Refresh systems
        updateMetrics();
        refreshMapTaskLayers();
        renderTasksList();
        runGeofenceVerification();

        showToast("Smart Reminder Added", `Successfully registered "${newTask.title}" at coordinates.`, "emerald");
    });

    // Toggle Live GPS tracking
    dom.btnLiveGps.addEventListener('click', () => {
        toggleLiveGpsTracking();
    });

    // Preset Teleportation simulator clicks
    dom.btnPresetOffice.addEventListener('click', () => {
        teleportUser(PRESETS.office[0], PRESETS.office[1], "Office HQ");
    });
    dom.btnPresetMarket.addEventListener('click', () => {
        teleportUser(PRESETS.market[0], PRESETS.market[1], "Hardware Market");
    });
    dom.btnPresetPark.addEventListener('click', () => {
        teleportUser(PRESETS.park[0], PRESETS.park[1], "Central Park Track");
    });
    dom.btnSimulateCurrent.addEventListener('click', () => {
        map.setView([state.userLocation.lat, state.userLocation.lng], 15, {
            animate: true,
            duration: 0.8
        });
        showToast("Avatar Centered", "Centered map on current simulated position.", "cyan");
    });

    // Toggle manual drag control modes
    dom.btnModeDrag.addEventListener('click', () => {
        state.dragModeActive = !state.dragModeActive;
        
        if (state.dragModeActive) {
            userMarker.dragging.enable();
            dom.btnModeDrag.classList.add('active');
            showToast("Interaction Mode", "Simulated avatar drag enabled. Drag the teal icon on map to move.", "cyan");
        } else {
            userMarker.dragging.disable();
            dom.btnModeDrag.classList.remove('active');
            showToast("Interaction Mode", "Drag locked. Tap presets to navigate.", "cyan");
        }
    });
    
    // Set default drag mode active visually
    dom.btnModeDrag.classList.add('active');

    // Tab Filters
    const tabs = [dom.tabAll, dom.tabPending, dom.tabTriggered];
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeTab = tab.dataset.filter;
            renderTasksList();
        });
    });

    // Search query bar keyups
    dom.searchBar.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        renderTasksList();
    });

    // Priority filter selector change
    dom.filterPriority.addEventListener('change', (e) => {
        state.filterPriority = e.target.value;
        renderTasksList();
    });
}

// Teleport Simulated Avatar coordinates instantly
function teleportUser(lat, lng, label) {
    state.userLocation.lat = lat;
    state.userLocation.lng = lng;
    
    userMarker.setLatLng([lat, lng]);
    map.setView([lat, lng], 15, {
        animate: true,
        duration: 1.0
    });

    showToast("Avatar Teleported", `Warped simulated GPS to ${label}`, "purple");
    runGeofenceVerification();
}

// Enable browser speech synthesis pre-fetching voices asynchronously
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
}

function toggleLiveGpsTracking() {
    state.liveTrackingActive = !state.liveTrackingActive;
    
    if (state.liveTrackingActive) {
        if (!("geolocation" in navigator)) {
            showToast("GPS Error", "Geolocation is not supported by your browser.", "rose");
            state.liveTrackingActive = false;
            return;
        }
        
        showToast("Requesting GPS", "Please grant location access in your browser pop-up...", "cyan");
        
        // Turn off manual drag mode while live GPS is active
        if (state.dragModeActive) {
            state.dragModeActive = false;
            userMarker.dragging.disable();
            dom.btnModeDrag.classList.remove('active');
        }
        
        dom.btnLiveGps.innerHTML = '<i class="fa-solid fa-satellite-dish fa-spin"></i> Tracking Live GPS';
        dom.btnLiveGps.classList.add('active');
        dom.btnLiveGps.style.borderColor = "var(--accent-emerald)";
        dom.btnLiveGps.style.color = "var(--accent-emerald)";
        
        state.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                state.userLocation.lat = lat;
                state.userLocation.lng = lng;
                
                userMarker.setLatLng([lat, lng]);
                
                // Recalculate proximity distances & active states
                runGeofenceVerification();
                
                // Dynamically render details
                renderTasksList();
                
                // Move map camera smoothly to the live GPS position
                map.setView([lat, lng], 15);
                
                // Update GPS beacon radar panel
                dom.gpsStatusText.textContent = `GPS Tracking active: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            },
            (error) => {
                console.error("GPS tracking error:", error);
                let errorMsg = "Could not retrieve GPS coordinates.";
                if (error.code === error.PERMISSION_DENIED) {
                    errorMsg = "Location permissions denied by user.";
                }
                showToast("GPS Access Failed", errorMsg, "rose");
                disableLiveGpsTracking();
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    } else {
        disableLiveGpsTracking();
    }
}

function disableLiveGpsTracking() {
    if (state.watchId !== null) {
        navigator.geolocation.clearWatch(state.watchId);
        state.watchId = null;
    }
    state.liveTrackingActive = false;
    
    dom.btnLiveGps.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Use Live GPS';
    dom.btnLiveGps.classList.remove('active');
    dom.btnLiveGps.style.borderColor = "";
    dom.btnLiveGps.style.color = "";
    
    // Re-enable manual dragging by default
    state.dragModeActive = true;
    userMarker.dragging.enable();
    dom.btnModeDrag.classList.add('active');
    
    showToast("GPS Tracking Paused", "Returned to manual geofence simulator mode.", "cyan");
    runGeofenceVerification();
    renderTasksList();
}
