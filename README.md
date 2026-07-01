<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0c0e1f,50:2b1245,100:0c0e1f&height=230&section=header&text=MANDALA&fontSize=68&fontColor=f2c14e&fontAlignY=38&desc=drawn%20by%20your%20music&descAlignY=58&descSize=18&descColor=5fe8ff&animation=fadeIn" width="100%"/>

<img src="https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=500&size=16&duration=2800&pause=1100&color=F2C14E&center=true&vCenter=true&width=640&lines=feed+it+music+and+watch+it+bloom.;bass%2C+mids%2C+highs%2C+and+beats+shape+the+pattern.;your+cursor+still+adds+its+own+strokes." alt="typing animation" />

<br/>

[![Enter the mandala](https://img.shields.io/badge/✦%20ENTER%20THE%20MANDALA%20✦-f2c14e?style=for-the-badge&labelColor=0c0e1f)](https://jaredbecker.github.io/mandala/)

<br/>

![p5.js](https://img.shields.io/badge/p5.js-ED225D?style=for-the-badge&logo=p5dotjs&logoColor=f4f1ea&labelColor=0c0e1f)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-f2c14e?style=for-the-badge&logo=javascript&logoColor=0c0e1f&labelColor=0c0e1f)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-5fe8ff?style=for-the-badge&logo=githubpages&logoColor=0c0e1f&labelColor=0c0e1f)
![No Build Step](https://img.shields.io/badge/build%20step-none-ff3e94?style=for-the-badge&labelColor=0c0e1f)

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:f2c14e,50:ff3e94,100:5fe8ff&height=3&section=header" width="100%"/>

</div>

<br/>

A living mandala that blooms to the music you feed it — symmetry, color, and light, generated in real time and driven by an audio analyser reacting to bass, mids, highs, and beats. Your cursor still works as an optional extra brush on top. No install, no build step, no dependencies to wrangle. One HTML file, one canvas, infinite pattern.

<br/>

<div align="center">

### ✦ how it works

</div>

On load you pick a source: paste a YouTube link, connect a browser tab that's already playing audio, or upload a file. A Web Audio analyser reads the signal in real time and auto-draws strokes that are mirrored and rotated around the center of the canvas — 2 to 60 times over, with an optional mirror reflection on top. Bass drives bloom/weight, mids drive sweep/rotation, highs drive shimmer/hue, and detected beats trigger a pulse flash. Your cursor remains a secondary brush: move it and your own strokes blend in with the audio-driven ones.

<div align="center">

### ✦ feeding it audio

</div>

Three ways to get sound in:

- **Paste a YouTube link** — drops in a visible embedded player and visualizes its audio.
- **Connect a tab's audio** — uses `getDisplayMedia` tab capture. This only works in **Chrome or Edge on desktop**. When the picker opens, choose **This Tab** and make sure to tick **Share tab audio** — otherwise no sound reaches the analyser.
- **Upload a file** — the universal fallback. Works everywhere, including Safari, Firefox, and mobile browsers, where tab capture isn't available.

<div align="center">

### ✦ the controls

</div>

<div align="center">

| ✦ Audio | ✦ Shape | ✦ Motion | ✦ Color | ✦ Trail & Canvas |
|:---|:---|:---|:---|:---|
| Reactivity | Symmetry (2–60 arms) | Brush size | Rainbow cycle | Fade (laser) or permanent |
| Bass ⟷ Treble focus | Mirror reflection | Cursor-speed reactivity | Radial gradient | Custom fade speed |
| Beat flash pulse | Flowing line / glowing ribbon / stippled dots / sparkle burst | Pulse brush | Solid color | Custom background |
| — | Chaos jitter | Sparkle dust · ambient auto-rotate | 5 palettes + adjustable glow | — |

</div>

<div align="center">

**Presets** — 🎇 Neon Dream · 🥇 Golden Bloom · 🌊 Deep Ocean · 🌪️ Chaos Bloom · 🎲 Surprise me

*Feed it music. Watch it become the brush.*

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:5fe8ff,50:ff3e94,100:f2c14e&height=3&section=header" width="100%"/>

<div align="center">

### ✦ running it locally

</div>

It's a static page, but browsers restrict microphone/tab-capture APIs and module loading on `file://`, so serve it over `http://` instead of double-clicking it:

```bash
git clone https://github.com/JaredBecker/mandala.git
cd mandala
python -m http.server
```

Then open the URL it prints (typically `http://localhost:8000`).

Everything — markup, styles, and the [p5.js](https://p5js.org/)-powered sketch — lives in a single `index.html`.

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:f2c14e,50:ff3e94,100:5fe8ff&height=3&section=header" width="100%"/>

<div align="center">

### ✦ tech

**[p5.js](https://p5js.org/)** for the canvas and drawing loop &nbsp;·&nbsp; **Web Audio API** (`AnalyserNode`) for bass/mid/high/beat analysis &nbsp;·&nbsp; **YouTube IFrame API** for the YouTube-link source &nbsp;·&nbsp; **`getDisplayMedia`** for tab-audio capture (Chrome/Edge desktop) &nbsp;·&nbsp; **Vanilla JS/CSS** — no framework, no bundler, nothing to compile

</div>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0c0e1f,50:2b1245,100:0c0e1f&height=120&section=footer&animation=fadeIn" width="100%"/>
