# Bibliografía y Fuentes Oficiales — CHRONO-SPHEREx

> **Equipo:** Ley de Conservación del Mate  
> **Desafío:** NASA Space Apps Challenge 2026 — *Planet X and SPHEREx*  
> **Repositorio público:** `https://github.com/jonasvillegass/NASA---SAC---2026`

Este documento registra formalmente todas las fuentes oficiales de la NASA/agencias socias y la bibliografía académica utilizada para fundamentar los algoritmos físicos, estadísticos, termodinámicos y espectroscópicos de **CHRONO-SPHEREx**.

---

## 1. Fuentes Oficiales de la NASA y Agencias Socias

| Recurso | Institución | Uso en el Proyecto | Enlace Oficial |
| :--- | :--- | :--- | :--- |
| **Planet X and SPHEREx Challenge** | NASA Space Apps 2026 | Especificación del reto, criterios de evaluación y recursos autorizados | https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=resources |
| **SPHEREx Mission Portal (IRSA)** | NASA / Caltech-IPAC | Documentación de la misión, 6 detectores y 102 canales espectrales ($0.75\text{–}5.0\,\mu\text{m}$) | https://irsa.ipac.caltech.edu/Missions/spherex.html |
| **IRSA SIA & IBE API (`spherex_dr1`)** | NASA / Caltech-IPAC | Consulta de exposiciones por coordenadas ICRS y descarga de recortes FITS reales | https://irsa.ipac.caltech.edu/SIA |
| **SPHEREx Data Products Documentation** | Caltech-IPAC | Estructura de los 7 HDUs (`IMAGE`, `FLAGS`, `VARIANCE`, `ZODI`, `EPSF`, `WCS-WAVE`) | https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/ |
| **IRSA SPHEREx Python Tutorials** | Caltech-IPAC | Protocolo oficial de extracción TAP/IBE y manejo de WCS | https://caltech-ipac.github.io/irsa-tutorials/spherex/ |
| **WiseView** | NASA / Backyard Worlds | Modelo de referencia para visor multi-época (*blink*), resta de imágenes y control de estiramiento | http://byw.tools/wiseview |
| **Gaia Data Release 3 (DR3)** | ESA / STScI | Astrometría de referencia y validación de movimiento propio y paralaje | https://archive.stsci.edu/missions-and-data/gaia |
| **NEOSSat & CADC** | Canadian Space Agency (CSA) | Referencia complementaria de objetos móviles del Sistema Solar | https://www.asc-csa.gc.ca/eng/satellites/neossat/ |

---

## 2. Bibliografía Académica (Fundamento Físico, Matemático, Termodinámico y Químico)

1. **Çengel, Y. A., & Boles, M. A.** *Termodinámica* (7.ª edición). McGraw-Hill.  
   *Aplicación:* Modelado radiativo de cuerpo negro, equilibrio térmico, ley de Stefan-Boltzmann ($E_b = \sigma T^4$) y estimación de temperatura efectiva ($T_{\text{eff}}$) en enanas marrones y objetos subestelares fríos.
2. **Devore, J. L.** *Probabilidad y Estadística para Ingeniería y Ciencias* (7.ª edición). Cengage Learning.  
   *Aplicación:* Combinación lineal de varianza mínima para co-adición de bandas ($\text{SNR}_{\text{coadd}}$), Teorema Central del Límite y pruebas de significancia estadística ($Z$-score) en imágenes diferencia.
3. **Kreyszig, E.** *Matemáticas Avanzadas para Ingeniería*. Limusa Wiley.  
   *Aplicación:* Álgebra matricial de imágenes, propagación de varianza en resta temporal ($\sigma_D = \sqrt{\sigma_1^2 + \sigma_2^2}$) y análisis numérico.
4. **Young, H. D., & Freedman, R. A. (Sears-Zemansky).** *Física Universitaria*, Vols. 1 y 2. Pearson.  
   *Aplicación:* Cinemática 2D y vectores de movimiento propio ($\mu_\alpha^*, \mu_\delta$), mecánica celeste/paralaje trigonométrica, óptica y radiación térmica.
5. **Serway, R. A., & Jewett, J. W.** *Física para Ciencias e Ingeniería*, Vol. 1. Cengage Learning.  
   *Aplicación:* Dinámica orbital, velocidad tangencial ($v_t = 4.74\,\mu\,d$) y escalas de distancia astronómica.
6. **Halliday, D., Resnick, R., & Walker, J.** *Fundamentos de Física*, Vol. 2. Wiley.  
   *Aplicación:* Ondas electromagnéticas en el infrarrojo cercano y caracterización espectral.
7. **Stewart, J.** *Cálculo de Varias Variables*. Cengage Learning.  
   *Aplicación:* Transformaciones de coordenadas y proyección tangencial en World Coordinate System (WCS).
8. **Chang, R., & Goldsby, K. A.** *Química*. McGraw-Hill.  
   *Aplicación:* Transiciones vibracionales infrarrojas y profundidades de absorción molecular ($A_{\text{mol}}$) para $\text{CH}_4$, $\text{H}_2\text{O}$, $\text{CO}_2$ y $\text{CO}$.

---

## 3. Estándares y Targets de Validación Citados
* **WISE J085510.83−071442.5** (Enana marrón tipo Y; $T_{\text{eff}} \approx 250\,\text{K}$, $\mu \approx 8.12''/\text{año}$, $d \approx 7.53\text{ ly}$).
* **Estrella de Barnard** ($\mu \approx 10.39''/\text{año}$, validación astrométrica de alto movimiento propio).
* **Epsilon Indi Ba/Bb**, **RW Aurigae** y **R Draconis** (validación de separación binaria y variabilidad fotométrica monopolo vs. dipolo).
