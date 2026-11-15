# Guía de Uso y Referencia de URL State

Este documento explica en detalle cómo funciona el sistema de **URL State** en el Explorador de Imágenes Espectrales SPHEREx, qué parámetros acepta la URL, cómo se validan y sincronizan, y ejemplos completos para cada caso de uso.

---

## 1. Arquitectura e Integración

El manejo de estado en la URL se distribuye en los siguientes módulos:

- **`src/lib/urlState.ts`**: Parsea, valida, sincroniza (`window.history.replaceState`) y limpia los parámetros de consulta de la URL.
- **`src/lib/coordinates.ts`**: Valida coordenadas de Ascensión Recta (`parseRA`) y Declinación (`parseDec`) tanto en grados decimales como en formato sexagesimal (HMS / DMS).
- **`src/lib/celestialResolver.ts`**: Resuelve nombres de cuerpos celestes contra presets locales y la API pública **CDS Sesame** (SIMBAD / NED / VizieR) mediante `resolveCelestialName`.
- **`src/App.tsx`**: Ejecuta la lectura inicial de la URL al montar la aplicación, gestiona la transición entre pantallas (`entry` → `loading` → `explorer`), mantiene sincronizada la URL durante la navegación y muestra la ventana emergente de error si el enlace no es válido.
- **`src/components/ShareButton.tsx`**: Genera y copia al portapapeles un enlace permanente con las coordenadas y ajustes de visualización activos.

---

## 2. Parámetros de URL Soportados

### 2.1. Parámetros de destino (búsqueda)

| Parámetro | Alias aceptados | Descripción | Formato / Valores válidos |
| :--- | :--- | :--- | :--- |
| `target` | `object`, `name`, `q` | Nombre de un cuerpo celeste a resolver. Tiene prioridad sobre `ra`/`dec` si ambos están presentes. | Texto no vacío (ej. `WISE 0855`, `M31`, `Barnard's Star`). |
| `ra` | — | Ascensión Recta (requiere `dec`). | Decimal `[0, 360]` (ej. `133.79513`) o HMS (ej. `08h55m10.831s`, `08:55:10.831`). |
| `dec` | — | Declinación (requiere `ra`). | Decimal `[-90, 90]` (ej. `-7.24515`) o DMS (ej. `-7d14m42.53s`, `-07:14:42.53`, `-7°14'42.53"`). |

### 2.2. Parámetros opcionales de consulta y visualización

| Parámetro | Valores válidos | Comportamiento si es inválido u omitido |
| :--- | :--- | :--- |
| `collection` | `spherex_dr1` | Se ignora y se usa el valor por defecto (`spherex_dr1` o el del preset). |
| `band` | Cualquier cadena no vacía (ej. `all`, `D1`..`D6`) | Se mantiene el valor por defecto (`all`). |
| `size` | Número finito `> 0` (se limita automáticamente al rango `[0.02, 1.0]` grados) | Se mantiene el valor por defecto (`0.12`). |
| `stretch` | `asinh`, `log`, `sqrt`, `linear` | Se mantiene el valor por defecto (`asinh`). |
| `colormap` | `inferno`, `viridis`, `plasma`, `magma`, `gray` | Se mantiene el valor por defecto (`inferno`). |
| `subtract_zodi` | `true`, `false` | Se mantiene el valor por defecto (`false`). |

---

## 3. Casos de Uso y Ejemplos

### Caso 1: Carga sin parámetros (Pantalla de inicio)
Cuando se accede a la URL raíz sin parámetros de búsqueda:

```text
https://tu-dominio.com/
```

**Comportamiento:**
1. `parseUrlState` retorna `{ kind: "none" }`.
2. La aplicación permanece en la pantalla de inicio (`entry`) sin modificar la URL.
3. Una vez que el usuario presiona **Comenzar / Start**, entra al explorador (`explorer`) y la URL comienza a sincronizarse con la búsqueda activa.

---

### Caso 2: Enlace directo con coordenadas válidas
Permite abrir el explorador directamente en una región del cielo y consultar las observaciones de SPHEREx.

**Ejemplo en grados decimales:**
```text
https://tu-dominio.com/?ra=133.79513&dec=-7.24515
```

**Ejemplo en formato sexagesimal (HMS / DMS):**
```text
https://tu-dominio.com/?ra=08h55m10.831s&dec=-7d14m42.53s
```

**Comportamiento:**
1. `parseUrlState` valida `ra` con `parseRA` y `dec` con `parseDec`.
2. Al ser ambas válidas, retorna `{ kind: "coords", ra, dec, options }`.
3. La aplicación abre directamente la pantalla `explorer` con el mapa dividido activado (`secondMapOpen = true`) y ejecuta `executeSearch` sobre esas coordenadas.

---

### Caso 3: Enlace con nombre de cuerpo celeste válido (Conversión automática a coordenadas)
Permite compartir o abrir un enlace usando el nombre común o identificador astronómico de un objeto.

**Ejemplos:**
```text
https://tu-dominio.com/?target=WISE%200855
https://tu-dominio.com/?target=Barnard%27s%20Star
https://tu-dominio.com/?target=M31
https://tu-dominio.com/?object=NGC%207000
```

**Comportamiento paso a paso:**
1. `parseUrlState` detecta el parámetro `target` (o alguno de los alias `object`, `name`, `q`) y retorna `{ kind: "target", target, options }`.
2. Mientras se resuelve el objeto, se muestra la pantalla de carga (`loading`).
3. La aplicación busca primero coincidencia en los presets locales (`t.presets`) y, si no coincide, consulta `resolveCelestialName` (CDS Sesame / SIMBAD).
4. Una vez resuelto:
   - Se **reemplaza la URL** en el navegador mediante `syncUrlState` (`window.history.replaceState`), eliminando `target` (y cualquier alias) y colocando sus coordenadas `ra` y `dec` correspondientes:
     ```text
     https://tu-dominio.com/?ra=08h55m10.831s&dec=-7d14m42.53s&collection=spherex_dr1&band=all&size=0.12&stretch=asinh&colormap=inferno&subtract_zodi=false
     ```
   - Se abre la pantalla `explorer` y se consulta IRSA SIA con esas coordenadas.

---

### Caso 4: Enlace con parámetros completos de visualización
Combina coordenadas (o un `target`) con ajustes específicos de campo visual, estiramiento de flujo, mapa de color y sustracción zodiacal.

**Ejemplo:**
```text
https://tu-dominio.com/?ra=17h57m48.498s&dec=%2B04d41m36.11s&collection=spherex_dr1&band=all&size=0.25&stretch=log&colormap=viridis&subtract_zodi=true
```

**Ejemplo combinando cuerpo celeste + ajustes:**
```text
https://tu-dominio.com/?target=M31&size=0.5&stretch=sqrt&colormap=plasma
```
*(Al resolverse `M31`, `target=M31` se reemplazará en la barra de direcciones por las coordenadas `ra` y `dec` de M31 manteniendo `size=0.5`, `stretch=sqrt` y `colormap=plasma`.)*

---

### Caso 5: Enlace con cuerpo celeste inválido o vacío
Ocurre cuando el usuario introduce un nombre inexistente o deja el parámetro vacío.

**Ejemplos:**
```text
https://tu-dominio.com/?target=ObjetoQueNoExiste12345
https://tu-dominio.com/?target=
```

**Comportamiento:**
1. Si `target` está vacío o `resolveCelestialName` lanza un error (`OBJECT_NOT_FOUND` / `EMPTY_QUERY`):
2. Se ejecuta `clearUrlState()` para limpiar los parámetros de la URL (`window.location.pathname`).
3. Se redirige al usuario a la pantalla de inicio (`entry`).
4. Se abre una **ventana emergente** (modal accesible con soporte de teclado `Escape` y traducción automática ES/EN) informando que el cuerpo celeste no es válido e incluyendo el valor ingresado.

---

### Caso 6: Enlace con coordenadas inválidas o incompletas
Ocurre cuando falta uno de los dos parámetros (`ra` o `dec`), o alguno está fuera de rango o mal formateado.

**Ejemplos:**
```text
https://tu-dominio.com/?ra=999&dec=-7.24515        # RA > 360 (inválido)
https://tu-dominio.com/?ra=133.79513&dec=-95       # Dec < -90 (inválido)
https://tu-dominio.com/?ra=abc&dec=xyz             # Formato no numérico ni HMS/DMS
https://tu-dominio.com/?ra=133.79513               # Falta parámetro dec
https://tu-dominio.com/?dec=-7.24515               # Falta parámetro ra
```

**Comportamiento:**
1. `parseUrlState` retorna `{ kind: "invalidCoords", rawCoords }`.
2. Se ejecuta `clearUrlState()` para dejar limpia la URL.
3. Se redirige a la pantalla de inicio (`entry`).
4. Se muestra la **ventana emergente** indicando que las coordenadas proporcionadas en el enlace no son válidas y recordando los formatos aceptados (RA `0–360°` o HMS, Dec `-90°` a `+90°` o DMS).

---

### Caso 7: Sincronización en vivo dentro del explorador
Una vez dentro de `explorer`:
- Cada búsqueda por coordenadas, selección de preset, búsqueda por nombre de cuerpo celeste o clic sobre el mapa celeste HiPS actualiza `activeUrlCoords`.
- Cada cambio en `collectionMode`, `band`, `size` (FOV/zoom), `stretch`, `colormap` o `subtractZodi` dispara `syncUrlState`, manteniendo la barra de direcciones siempre actualizada sin recargar la página ni ensuciar el historial de navegación (`replaceState`).
- El botón **Compartir Enlace de Observación / Share Observation Link** (`ShareButton.tsx`) genera exactamente la misma estructura de permalink para copiarla al portapapeles.

---

## 4. Referencia Rápida de `src/lib/urlState.ts`

```ts
// Analiza window.location.search y devuelve un estado tipado discriminado
parseUrlState(search: string): ParsedUrlState

// Actualiza la URL actual mediante window.history.replaceState con coordenadas y ajustes
syncUrlState(payload: UrlSyncPayload): void

// Elimina los query params dejando únicamente window.location.pathname
clearUrlState(): void
```
