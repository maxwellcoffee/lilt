# Lilt

A hands-free walking instrument. Wear AirPods, tap **Begin** once, then stop touching the phone.

Walking sets the tempo. Humming or talking is chopped into samples. Nodding, turning, and tilting your head steers bass, filter, echo, and snare accents.

## How to play

1. Connect AirPods (or any headphones with a mic).
2. Open the app in Safari or Chrome on a phone. HTTPS is required for mic, camera, and motion.
3. Tap **Begin** and allow microphone. Allow motion when iOS asks. Allow the camera if you want head tracking while the front camera can see your face.
4. Put the phone in a pocket or hold it. Walk. Hum a phrase. Turn your head.

After that first tap the walk runs itself. Open **Mix** on the start screen or during a walk. Sliders cover volume, the pad bed, voice, drums, how busy the hats get, how strongly head motion steers, how short hums get chopped, how long a note must be to loop, how tightly grains snap to the key, how easily hums catch, echo, hall space, brightness, swing, and whether tempo follows your gait or stays locked. Follow walk has a Glide slider that sets how tightly live BPM chases gait. Hall is how long the room rings. Space is how wet that ring sits. Late is how far the echo sits behind the step. Echo is how wet that slap sits. Reach is how far a head turn opens the filter. Bite is how sharp that filter sings. Key chips pick the harmony the bass and grains snap to. Hush ducks the drums when you stand still. Thump sets how easily the mic hears footsteps. Nod is how easily a head dip fires a snare, split from Steer so a jacket can stay still on the filter. Turn is how easily a head yaw fires a tom, for the same reason. Wait is how long after a nod or a turn before another can fire. Bounce is how easily the phone IMU counts a step. Hang is how long a step keeps you marked walking, so Hush and the extra kicks stay on after the foot lifts. Gap is how long after a step before the next one counts. Lag is how long after a step-kick before another step can fire one. Pocket keeps Bounce low so a jacket does not fire kicks, and Hang high so sparse thumps still count as a walk. Drive is bass grit. Punch is how tight the kick clicks. Skin is how bright the snare sits. Snare is how loud a nod sits against the kick. Hats is how loud the tick sits against the kick. Kick is how loud a step sits against nods and ticks. Tom is how loud a head turn sits against the kick. Snap is how tightly grains lock to the key. Scatter is how far a hummed phrase wanders through older grains. Width is how far grains follow a head turn. Pulse is the phone buzz on the kick. `[` and `]` nudge a locked BPM. Mix is grouped into Sound, Color, Voice, Move, Key, and Tempo. The groups start folded with a one-line hint. Opening one group closes the others. Key chips sit under the presets. Street / Room / Soft / Pocket are starting points. Pocket is for a phone in a jacket, with head-steer turned down and the mic catching steps. Mix is optional. End walk lives in that same drawer. Press `M` to open Mix. `Z` undoes the last Mix change. Comma and period cycle Street / Room / Soft / Pocket. On a laptop, move the pointer to steer and press Space for a step. Lit sample dots in the HUD play that grain when you tap them. Keys 1 through 5 do the same. When tempo is locked, the BPM figure pulses with the click. Locking tempo shows a Click slider so you can hear the grid without walking.

| Body | Music |
| --- | --- |
| Steps (phone IMU or thumps in the AirPods mic) | Kick + tempo |
| Hum / talk | Captured grains, replayed on the beat |
| Held notes | A quiet looping bed |
| Nod | Snare accent |
| Turn | Bass note, filter, stereo |
| Tilt | Swing and echo |

## What the browser can and cannot hear

AirPods become the microphone and the speakers as soon as they are the system audio device. That is how voice samples and in-ear beats work.

Browsers do not expose Apple’s headphone IMU (`CMHeadphoneMotionManager`). Lilt therefore fuses three signals that *are* available on the web:

- **AirPods microphone** — voice grains and footstep thumps
- **Phone motion** — gait and, when the phone is in your hand, tilt
- **Front camera** — head yaw / pitch / roll while your face is visible

Phone-in-pocket walking still works. Head-steering is strongest when the camera can see you, or when you are holding the phone.

## Run locally

```bash
npm install
npm run build
npm start
```

The production server listens on [http://127.0.0.1:43217](http://127.0.0.1:43217). `next dev` is fine on a laptop. Use the production build if a preview proxy is in front of the app.

Use a real device for AirPods and walking. On a laptop, hum into the mic, look at the camera, or move the pointer to steer. On a phone, Add to Home Screen for a full-bleed walk.

## Stack

Next.js, Web Audio, DeviceMotion / DeviceOrientation, MediaPipe Face Landmarker.
