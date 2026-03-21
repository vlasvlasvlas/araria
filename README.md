# Araria

Animacion interactiva de aranas con audio procedural en `Canvas 2D` + `Web Audio API`, sin dependencias ni build step.

## Modos

### Ambiente

Modo libre donde varias aranas siguen el cursor o el toque.

- Las aranas reaccionan al movimiento en desktop y mobile.
- Se puede ajustar cantidad, velocidad, textura y audio.

### Vida

Modo de ciclo de vida con huevos, nacimiento, crecimiento y muerte.

- Mantener presionado `3 segundos` crea un huevo.
- Si se mueve el mouse o el dedo durante el hold, la creacion se cancela.
- El huevo eclosiona mas rapido cerca del cursor.
- La arana nace muy chica, empieza con pocas patas y crece mientras se alimenta cerca del cursor.
- Lejos del cursor envejece y muere mas rapido.

## Controles

Controles compartidos:

- `💨` velocidad
- `🦗` volumen de patas
- `🌑` drone
- `🌊` ambiente (`reverb + delay`)
- `🔇 / 🔊` audio global

Controles solo de `Ambiente`:

- `🕸️` cantidad de aranas
- `🧪` textura sonora de las patas

Navegacion:

- Click en `🕷️ Araria` para volver al menu inicial y elegir modo otra vez.

## Uso local

Clonar el repo y abrir `index.html` en el navegador.

```bash
git clone https://github.com/vlasvlasvlas/araria.git
cd araria
```

Si preferis un server local:

```bash
python3 -m http.server 8080
```

Luego abrir `http://localhost:8080`.

## Estructura

```text
araria/
├── index.html
├── style.css
├── audio.js
├── script.js
├── life.js
├── game.js
└── README.md
```

## Archivos principales

- `audio.js`: motor de audio procedural, drones, ambiente y sonidos de patas, huevo, eclosion y muerte.
- `script.js`: modo `Ambiente`.
- `life.js`: modo `Vida`.
- `game.js`: menu, cambio de modo, loop principal y controles compartidos.

## Stack

- HTML5
- CSS
- JavaScript vanilla
- Canvas 2D
- Web Audio API

## Estado actual

- Funciona en desktop y mobile.
- No usa dependencias externas de runtime.
- No incluye sistema de telas de arana.
