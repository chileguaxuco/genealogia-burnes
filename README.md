# Genealogía Familia Burnes

Árbol genealógico interactivo de la familia Burnes (1757–2023), construido con D3.js y Mapbox GL JS. Visualiza cinco generaciones de la familia con un árbol navegable, mapa de eventos geográficos, y panel de detalle por persona.

## Setup

**1. Configurar credenciales:**

```bash
cp config.example.js config.js
# Editar config.js y agregar tu token de Mapbox
```

`config.js` está en `.gitignore` y nunca se sube al repositorio.

**2. Servir localmente:**

```bash
python -m http.server 8080
# o en Windows PowerShell:
.\server.ps1
```

Abrir `http://localhost:8080` en el navegador.

> Requiere servidor local (no funciona directo desde `file://`) por las restricciones de CORS en ES modules y `fetch`.

---

## Funcionalidades

- **Árbol genealógico** — Visualización D3.js con layout por generaciones, nodos con nombre y fechas, zoom/pan libre
- **Mapa de eventos** — Mapbox GL JS con marcadores de nacimiento, defunción, matrimonio y líneas de migración
- **Buscador de personas** — Búsqueda fuzzy sin acentos, dropdown con navegación por teclado, atajo `/`
- **Panel de detalle** — Avatar con iniciales, línea de vida, fechas, lugares, chips de familia navegables
- **Filtro temporal** — Slider 1757–2023 que filtra el árbol y el mapa por año, con tooltip de año
- **Transiciones** — Slide direccional entre árbol/mapa, cascada de secciones en el panel, transición de tamaño en nodos filtrados

---

## Stack técnico

| Tecnología | Uso |
|---|---|
| HTML/CSS/JS Vanilla | Sin frameworks — ES Modules nativos |
| [D3.js v7](https://d3js.org/) | Árbol genealógico y layout por generaciones |
| [Mapbox GL JS v3](https://docs.mapbox.com/mapbox-gl-js/) | Mapa interactivo con marcadores y líneas |
| Google Fonts | Zilla Slab (serif) + Inter (sans) |

---

## Estructura de archivos

```
genealogia-burnes/
├── index.html          # HTML principal + estructura del panel
├── data.json           # Datos de personas y coordenadas geográficas
├── css/
│   └── style.css       # Paleta "Archival Luxury", animaciones, responsive
└── js/
    ├── app.js          # Controlador principal, tabs, timeline
    ├── tree.js         # D3 tree: layout, renderizado, transiciones
    ├── map.js          # Mapbox: marcadores, líneas de migración, filtros
    ├── panel.js        # Panel de detalle: hero, lifeline, chips de familia
    ├── search.js       # Buscador: fuzzy match, debounce, nav por teclado
    └── utils.js        # Utilidades compartidas: extractYear, formatDate, etc.
```

---

## Estructura de `data.json`

```json
{
  "persons": [
    {
      "id": "AA1",
      "name": "Juan Burnes",
      "generation": 0,
      "birthDate": "1757",
      "deathDate": null,
      "birthPlace": "General Terán",
      "father": null, "mother": null,
      "spouseId": "AA2",
      "children": ["BA1", "BA3", "BA4"],
      "notes": "...",
      "references": "..."
    }
  ],
  "locations": {
    "General Terán": { "lat": 25.24, "lng": -99.68 }
  }
}
```

Campos de persona: `id`, `name`, `generation` (0 = primer ancestro conocido), `birthDate/deathDate/marriageDate` (formato `YYYY` o `YYYY-MM-DD`), `birthPlace/deathPlace/marriagePlace`, `father`, `mother`, `spouseId`, `children[]`, `siblings[]`, `migration[]`, `notes`, `references`.

---

## Historial de cambios

### 2026-02-22 — Rediseño Frontend/UX completo

**Objetivo:** Modernizar la interfaz manteniendo el stack vanilla. Estilo "Archival Luxury": elegante, minimalista, con los datos como protagonistas.

**Cambios principales:**

- **CSS overhaul** — Nueva paleta (`--bg-main: #F7F5F0`, `--accent: #5C4A32`), escala tipográfica consistente, variables de sombra (`--shadow-sm/md/lg`) y movimiento (`--ease-out`, `--duration-fast/normal/slow`), soporte `prefers-reduced-motion`
- **ES Modules** — Migración de scripts globales a módulos nativos (`type="module"`), eliminación de variables globales en `window`
- **`utils.js`** — Funciones compartidas extraídas: `extractYear`, `formatDate`, `normalizeStr`, `debounce`, etc.
- **`panel.js`** — Panel refactorizado: avatar circular con iniciales (color por generación), línea de vida con puntos codificados por tipo de evento, chips de familia clicables con event delegation (reemplaza el hack de `setTimeout`)
- **`search.js`** — Buscador nuevo: fuzzy match NFD (sin acentos), debounce 150ms, máx. 6 resultados, navegación por teclado (↑↓/Enter/Escape), atajo `/`, versión móvil colapsable
- **Transiciones D3** — Nodos del árbol transicionan su radio (20px → 14px) al filtrarse por año, con duración 380ms
- **Slide direccional** — Cambio árbol↔mapa con deslizamiento izquierda/derecha según la dirección de navegación
- **Tooltip en timeline** — Muestra el año sobre el thumb del slider mientras se arrastra
- **ARIA + accesibilidad** — Labels, roles y `aria-live` en elementos clave; `focus-visible` en todos los controles
- **Open Graph** — Meta tags para compartir en redes sociales

### Versiones anteriores

- **2023–2024** — Primera versión: árbol D3, mapa Mapbox, panel básico, slider de año

---

## Desarrollo futuro

- [ ] Fotos de personas (carrusel horizontal)
- [ ] Exportar subárbol como PNG/SVG
- [ ] Modo oscuro
- [ ] Más generaciones (datos pendientes de investigación)
