# GeoMind Reminders - Location-Based Smart Reminder App

GeoMind is a premium, high-fidelity, real-time geofencing smart productivity application that integrates note-taking with map location awareness. It visually, audibly, and verbally notifies you the exact moment you enter custom-defined circular ranges of your physical tasks.

---

## 🚀 Key Features Built-In

1. **Vibrant Obsidian Glassmorphic UI**: High-fidelity dark mode dashboard styling using Outfit and Inter Google Fonts, responsive grid cards, pulsing indicator buttons, custom tabs, and sliding toast windows.
2. **Interactive Map Simulation**: Full Leaflet.js map layer integrations with a draggable "user avatar" marker. The map uses CartoDB Dark Matter tile rendering, which matches the dark futuristic aesthetics flawlessly.
3. **Advanced Geofence Engine**: Utilizes the high-precision **Haversine formula** to compute physical distances in meters from the user marker to all custom tasks, running dynamically on every avatar coordinate update.
4. **Real-Time GPS Tracking Integration**: A single click on **"Use Live GPS"** requests standard browser location permissions (`navigator.geolocation.watchPosition`) to track your exact physical real-world movement and dynamically compute proximity distances to your target tasks!
5. **Google Maps Navigation Routing**: Tap the compass icon on any reminder card to launch active driving/walking turn-by-turn directions from your simulated or live physical coordinates directly inside Google Maps!
6. **Autonomous Voice Synthesis Notifications**: Integrated with the native browser **SpeechSynthesis API** to announce task reminders verbally in a premium speech synthesized voice.
7. **Dynamic Audio Beacon Synths**: Synthesizes clean electronic high-priority alert tones directly using the browser **Web Audio API** (`AudioContext`), running completely offline with no dependencies on slow external sound assets.
8. **Double-Click Shortcut Creator**: Double-clicking anywhere on the map immediately launches the "Create Task Modal" with the exact latitude and longitude coordinates auto-populated!
9. **Simulation Controls**: Walk, drag, or teleport instantly to preset locations (Market, Central Park, Corporate Office HQ) to watch geofences react, change boundaries, and speak in real-time.
10. **State Persistence**: Preserves all reminder titles, descriptions, radii, deadlines, checkmarks, and custom markers in browser `localStorage`.

---

## 🛠️ Technology Stack Built

- **Frontend Core**: HTML5 Semantic Architecture + Modern Vanilla CSS3 Grid/Flexbox Layouts.
- **Visual Design**: Curated translucent glassmorphism (`backdrop-filter: blur()`), glowing active borders, responsive media queries, and animated keyframes.
- **Mapping Systems**: **Leaflet.js** (Standard Web Map GIS) utilizing **CartoDB Dark Matter** dark tile layers.
- **Icons Resource**: FontAwesome v6 CDN.
- **Alert Synths**: Web Audio API oscillator nodes.
- **Voice Reminder Engine**: Web Speech Synthesis API.
- **Data Layer**: JSON structures persisted in local browser cache (`localStorage`).

---

## 📐 Proximity Logic: Haversine Equation
To calculate the physical distance between the user's current GPS position and the tagged task marker over the surface of the earth, the geofencing engine uses the **Haversine Formula**:

$$a = \sin^2\left(\frac{\Delta \varphi}{2}\right) + \cos(\varphi_1) \cdot \cos(\varphi_2) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$

$$d = R \cdot c$$

*Where:*
- $\varphi$ is latitude in radians.
- $\lambda$ is longitude in radians.
- $\Delta\varphi = \varphi_2 - \varphi_1$.
- $\Delta\lambda = \lambda_2 - \lambda_1$.
- $R$ is Earth's mean radius ($6,371,000$ meters).
- $d$ is the calculated distance in meters.

If the distance $d \le \text{Task Radius (meters)}$, the task boundary is breached, changing card state to active green, playing the synth alert, and speaking the title out loud!

---

## 🏁 Quick Start & Usage

1. Open `index.html` inside any web browser (Chrome, Edge, Firefox, or Safari).
2. **Move Avatar**: Ensure the **"Manual Drag"** control button is active (teal color). Click and drag the glowing teal user pin on the map.
3. **Trigger Reminders**:
   - Drag the user pin inside the dotted circles (red, purple, or blue geofences) on the map.
   - Or click **"Go to Market"** or **"Go to Office"** to teleport the avatar instantly inside the geofence.
   - Watch the instant visual green glow on the card, hear the notification chime, and listen to the voice reader announce your tasks!
4. **Create Custom Reminders**:
   - Click the primary **"Create Location Reminder"** button at the bottom right.
   - *OR* simply double-click any spot on the map to pre-fill coordinates.
   - Set titles, radius size (in meters), priority color-code tags, and hit Save!
5. **Dismiss/Delete**:
   - Check the checkbox on the task card to complete it.
   - Click the trash icon to delete it from the registry.

*Designed with 💜 for a premium modern note-taking & location awareness experience.*
