/**
 * CHRONO-SPHEREx — Astro-Sonification & Accessibility Engine
 * 
 * Implements physical-acoustic mapping of SPHEREx 102-band infrared spectroscopy
 * and Clyde Tombaugh multi-epoch Blink spatial audio for visually impaired users.
 * 
 * Physical Foundations:
 * - Photon Energy: E = h * c / lambda
 * - Frequency Mapping: lambda in [0.75, 5.0] um -> f in [2200, 200] Hz (Inverse wavelength / linear energy)
 * - Flux Scaling: S_nu (MJy/sr) -> Gain / Acoustic Amplitude [0.0, 0.8]
 * - Spatial Stereo Blinking: Epoch 1 (Left ear) vs Epoch 2 (Right ear) via StereoPannerNode
 * 
 * Standards:
 * - Web Audio API (W3C Recommendation)
 * - WCAG 2.1 Level AA Accessibility (Auditory alternatives to visual data)
 * - NASA System Sounds / STScI Astronify compatibility
 */

export interface SpectrumDataPoint {
  wave_um: number;
  flux: number | null;
  bandpass: string;
  snr?: number | null;
}

class AstroSonificationEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentTimeout: any = null;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Convert SPHEREx infrared wavelength (0.75 - 5.0 um) into acoustic audio frequency (2200 - 200 Hz).
   * Shorter wavelengths (high energy NIR) produce higher pitch;
   * Longer wavelengths (cool MIR) produce deep bass.
   */
  public wavelengthToFrequency(wave_um: number): number {
    const minWave = 0.75;
    const maxWave = 5.0;
    const minFreq = 220; // A3 (Bass)
    const maxFreq = 2200; // ~C7 (Treble)

    const clamped = Math.max(minWave, Math.min(maxWave, wave_um));
    // Linear in energy E proportional to 1 / lambda
    const norm = (1 / clamped - 1 / maxWave) / (1 / minWave - 1 / maxWave);
    return minFreq + norm * (maxFreq - minFreq);
  }

  /**
   * Play an individual spectral band note.
   */
  public playBandNote(wave_um: number, flux: number | null, durationMs: number = 250, pan: number = 0): void {
    const ctx = this.initContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    const freq = this.wavelengthToFrequency(wave_um);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Normalize flux to audible gain [0.05, 0.4]
    const volume = flux !== null && flux > 0 ? Math.min(0.4, Math.max(0.05, Math.log10(flux + 1) * 0.2)) : 0.05;

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    if (panner) {
      panner.pan.setValueAtTime(pan, ctx.currentTime);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }

  /**
   * Play the full 102-band spectrum as an acoustic sweep from 0.75 um to 5.0 um.
   * Allows a blind person to detect molecular absorption lines (H2O, CH4, CO2)
   * as audible dips/notches in the melody.
   */
  public playSpectrumSweep(
    points: SpectrumDataPoint[],
    onProgress?: (index: number, point: SpectrumDataPoint) => void,
    onComplete?: () => void
  ): () => void {
    this.stop();
    const ctx = this.initContext();
    this.isPlaying = true;

    const validPoints = points.filter((p) => p.wave_um >= 0.7 && p.wave_um <= 5.1);
    if (validPoints.length === 0) {
      this.isPlaying = false;
      onComplete?.();
      return () => {};
    }

    const stepMs = Math.max(60, Math.min(180, 5000 / validPoints.length));
    let idx = 0;

    const playNext = () => {
      if (!this.isPlaying || idx >= validPoints.length) {
        this.isPlaying = false;
        onComplete?.();
        return;
      }

      const pt = validPoints[idx];
      this.playBandNote(pt.wave_um, pt.flux, stepMs * 1.2, 0);
      onProgress?.(idx, pt);

      idx++;
      this.currentTimeout = setTimeout(playNext, stepMs);
    };

    playNext();

    // Return cancellation callback
    return () => this.stop();
  }

  /**
   * Spatial Audio Blink (Clyde Tombaugh Acoustic Comparator):
   * Alternates between Epoch 1 (panned Left) and Epoch 2 (panned Right).
   * Fixed stars sound centered and steady; moving objects (Planet Nine, asteroids)
   * produce an audible jump across the stereo field!
   */
  public playAcousticBlink(
    epochA: { name: string; flux: number; wave_um?: number },
    epochB: { name: string; flux: number; wave_um?: number },
    speedMs: number = 400
  ): () => void {
    this.stop();
    this.initContext();
    this.isPlaying = true;

    let toggle = false;

    const blinkLoop = () => {
      if (!this.isPlaying) return;

      const current = toggle ? epochB : epochA;
      const pan = toggle ? 0.75 : -0.75; // Right ear vs Left ear
      const wave = current.wave_um || 2.5;

      this.playBandNote(wave, current.flux, speedMs * 0.8, pan);

      toggle = !toggle;
      this.currentTimeout = setTimeout(blinkLoop, speedMs);
    };

    blinkLoop();
    return () => this.stop();
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Generate an accessible verbal description of the celestial target
   * for screen readers (NVDA, JAWS, VoiceOver).
   */
  public generateAccessibleTargetSummary(params: {
    targetName: string;
    ra: number;
    dec: number;
    bandsCount: number;
    dominantFeatures?: string[];
    isDipoleCandidate?: boolean;
    temperatureK?: number;
  }): string {
    const { targetName, ra, dec, bandsCount, dominantFeatures = [], isDipoleCandidate, temperatureK } = params;

    const parts = [
      `Target ${targetName || "Observation"}.`,
      `Located at celestial coordinates Right Ascension ${ra.toFixed(4)} degrees, Declination ${dec.toFixed(4)} degrees.`,
      `Analyzed across ${bandsCount} infrared photometric bands from 0.75 to 5.0 micrometers by NASA SPHEREx.`,
    ];

    if (temperatureK) {
      parts.push(`Estimated blackbody thermodynamic temperature is ${Math.round(temperatureK)} Kelvin.`);
    }

    if (dominantFeatures.length > 0) {
      parts.push(`Detected molecular absorption features: ${dominantFeatures.join(", ")}.`);
    }

    if (isDipoleCandidate) {
      parts.push("High-confidence motion dipole detected between multi-epoch observations, consistent with a moving Solar System body or high proper-motion candidate.");
    } else {
      parts.push("Photometric field shows static celestial background.");
    }

    return parts.join(" ");
  }
}

export const astroSonification = new AstroSonificationEngine();
