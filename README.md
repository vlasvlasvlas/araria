# 🕷️ Araria
### Interactive spider animation with procedural horror audio.

Arañas generativas que siguen tu cursor, con sonido procedural en tiempo real — cada clic de pata, cada eco de caverna, generado por Web Audio API. Sin samples, sin dependencias, puro vanilla.

## ✨ Demo

Abrí `index.html` en tu browser. Mové el mouse. Activá el audio (🔇→🔊).

## 🎮 Controles

| Control | Función |
|---------|---------|
| 🕸️ | Cantidad de arañas (1-20) |
| 💨 | Velocidad de seguimiento |
| 🔊/🔇 | Audio on/off |
| 🦗 | Volumen de patas (clicks de insecto) |
| 🌑 | Drone ambiental (caverna oscura) |
| 🌊 | Ambiente (reverb + delay combinados) |

## 🔊 Audio Procedural

Todo el audio se genera en tiempo real con **Web Audio API**:

- **Clicks de patas**: noise bursts filtrados (bandpass 2-6kHz) que se disparan cuando cada pata toca el suelo visualmente
- **Drone**: osciladores sine detuned (58-63Hz) + sub-bass + textura de caverna
- **Reverb**: impulse response sintético de 3 segundos (caverna oscura)
- **Delay**: feedback loop con filtro lowpass para eco repetitivo

Cada pata tiene un pitch ligeramente distinto. El sonido se panea estéreo según la posición en pantalla.

## 🛠️ Tech Stack

- HTML5 Canvas 2D
- Vanilla JavaScript (ES6+)
- Web Audio API
- Vanilla CSS
- Google Fonts (Outfit)

**Cero dependencias. Cero bundlers. Cero frameworks.**

## 📁 Estructura

```
araria/
├── index.html    → Estructura y controles UI
├── style.css     → Estilos (glassmorphism header, sliders custom)
├── script.js     → Arañas, animación, interacción
├── audio.js      → Motor de audio procedural
└── README.md
```

## 🚀 Uso

```bash
# Clonar
git clone https://github.com/tu-usuario/araria.git

# Abrir
open araria/index.html
```

O simplemente servir con cualquier servidor local:
```bash
npx serve .
```

## 🔮 Roadmap

- [x] Arañas generativas con patas orgánicas
- [x] Audio procedural ligado a movimiento de patas
- [x] Controles de audio (insecto, drone, ambiente)
- [ ] **Modo Juego**: clicks para colocar huevos, ciclo de vida (egg→baby→adult→old→dead)
- [ ] Reproducción automática y genética heredable
- [ ] Audio adaptivo por población
- [ ] Zoom, paredes, guardar/cargar colonia

## 🎨 Créditos

- Basado originalmente en un script de **codetutor** donde elementos seguían al cursor.

## 📄 Licencia

MIT
