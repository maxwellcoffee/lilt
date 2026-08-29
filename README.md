# Lilt

A hands-free walking instrument. Wear AirPods, tap **Begin** once, then stop touching the phone.

Walking sets the tempo. Humming or talking is chopped into samples. Nodding, turning, and tilting your head steers bass, filter, echo, and snare accents.

## How to play

1. Connect AirPods (or any headphones with a mic).
2. Open the app in Safari or Chrome on a phone. HTTPS is required for mic, camera, and motion.
3. Tap **Begin** and allow microphone. Allow motion when iOS asks. Allow the camera if you want head tracking while the front camera can see your face.
4. Put the phone in a pocket or hold it. Walk. Hum a phrase. Turn your head.

After that first tap the walk runs itself. Open **Mix** on the start screen or during a walk. Sliders cover volume, voice, drums, how busy the hats get, how strongly head motion steers, how short hums get chopped, how easily hums catch, echo, brightness, swing, and whether tempo follows your gait or stays locked. Street / Room / Soft / Pocket are starting points. Pocket is for a phone in a jacket, with head-steer turned down and the mic catching steps. Mix is optional. End walk lives in that same drawer. Press `M` to open Mix. On a laptop, move the pointer to steer and press Space for a step.

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
npm run dev
```

The dev server listens on [http://127.0.0.1:43217](http://127.0.0.1:43217).

Use a real device for AirPods and walking. On a laptop, hum into the mic, look at the camera, or move the pointer to steer. On a phone, Add to Home Screen for a full-bleed walk.

## Stack

Next.js, Web Audio, DeviceMotion / DeviceOrientation, MediaPipe Face Landmarker.
