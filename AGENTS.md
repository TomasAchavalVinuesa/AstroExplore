# Guía y Reglas para Agentes (AGENTS.md)

Este documento define los estándares técnicos, lineamientos de internacionalización y convenciones de control de versiones que cualquier agente de inteligencia artificial o desarrollador debe seguir estrictamente al interactuar con este repositorio.

---

## 1. Stack Tecnológico

El proyecto está configurado bajo una arquitectura frontend moderna, rápida y sin dependencias de servidor pesadas. Se debe respetar y mantener el siguiente stack:

- **Librería UI:** [React 19](https://react.dev/) (componentes funcionales, hooks nativos).
- **Entorno y Bundler:** [Vite 6+](https://vitejs.dev/) (`@vitejs/plugin-react`).
- **Lenguaje:** [TypeScript 5.7+](https://www.typescriptlang.org/) con tipado estricto.
- **Estilos:** [Tailwind CSS 3.4+](https://tailwindcss.com/) junto con PostCSS y Autoprefixer. Utilidad auxiliar con `clsx` y `tailwind-merge` para clases dinámicas.
- **Iconografía:** [Lucide React](https://lucide.dev/).
- **Procesamiento de Datos Astronómicos:**
  - Decodificación y análisis de binarios FITS en el cliente utilizando `DataView` y la API Canvas de HTML5.
  - Consumo directo de servicios públicos de la NASA / IPAC IRSA:
    - **IRSA SIA** (*Simple Image Access*): Descubrimiento y metadatos de observaciones.
    - **IRSA IBE Cutouts**: Extracción y descarga de recortes FITS espectrales.
- **Principio de simplicidad:** No agregar frameworks backend, servidores intermedios ni librerías pesadas no justificadas. Todo el procesamiento y renderizado visual debe mantenerse del lado del cliente cuando sea posible.

---

## 2. Internacionalización y Textos (i18n: Inglés y Español)

Para garantizar una experiencia accesible tanto a nivel local como internacional:

1. **Doble versión obligatoria (ES / EN):**
   - **Todo** texto que se implemente en la interfaz de usuario debe contar obligatoriamente con su versión en **español** y en **inglés**.
   - Esto incluye títulos, subtítulos, botones, etiquetas de formulario, placeholders, opciones de selectores, tooltips, estados de carga, alertas y mensajes de error.
2. **Asociación al selector de idioma:**
   - Todo texto debe estar asociado dinámicamente al estado del selector de idioma (`es` / `en`).
   - Queda estrictamente prohibido hardcodear cadenas de texto en un solo idioma dentro del JSX o componentes sin su correspondiente entrada en ambos idiomas.
3. **Estructura y consistencia:**
   - Al agregar nuevas funcionalidades, componentes o mensajes, deben actualizarse los diccionarios o contextos de traducción para ambos idiomas manteniendo concordancia técnica y naturalidad en la redacción.

---

## 3. Protocolo de Commits

Cada vez que el usuario solicite realizar un commit (o preparar un mensaje de commit), se debe seguir el siguiente formato:

### 3.1 Tipo de Cambio
Se debe informar explícitamente a cuál de las siguientes categorías pertenece el cambio:
- **Modificación:** Para nuevas características, actualización de dependencias, cambios de diseño o refactorizaciones (`feat`, `refactor`, `style`, `chore`).
- **Arreglo:** Para soluciones de errores, bugs o correcciones de comportamiento (`fix`, `bugfix`).
- **Otro:** Para documentación, configuración de build, rendimiento o pruebas (`docs`, `test`, `perf`, `build`).

### 3.2 Descripción
La descripción debe ser breve, directa y explicar de forma concisa qué se hizo, sin ambigüedades.

### 3.3 Formato sugerido para el mensaje de commit
```text
[Tipo]: <Descripción breve y directa>

# Ejemplos:
# Modificación: Implementar selector de idioma ES/EN y soporte bilingüe en Navbar
# Arreglo: Corregir parseo de coordenadas sexagesimales con declinación negativa
# Modificación: Integrar visualización de recortes FITS con escala Asinh
# Otro: Actualizar documentación técnica en README.md y AGENTS.md
```

