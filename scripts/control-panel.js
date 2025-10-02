// control-panel.js
import { DonkiAPI } from './donki-api.js';

export class ControlPanel {
  constructor(simulationParams) {
    this.panel = document.getElementById('control-panel');
    this.simulationParams = simulationParams;
    this.callbacks = [];
    if (!this.panel) console.error('Control panel not found');
  }
  onParamChange(cb) {
    this.callbacks.push(cb);
  }
  updateValues(newParams) {
    for (const key in newParams) {
      if (Object.prototype.hasOwnProperty.call(this.simulationParams, key)) {
        this.simulationParams[key] = newParams[key];
        const input = this.panel.querySelector(`input[name="${key}"]`);
        if (input) {
          input.value = newParams[key];
          const wrapper = input.closest('.control-input-wrapper');
          const valueDisplay = wrapper ? wrapper.querySelector('.control-value') : null;
          if (valueDisplay) {
            valueDisplay.textContent = newParams[key];
          }
        }
      }
    }
    this.callbacks.forEach(cb => cb(this.simulationParams));
  }
  setInputsEnabled(enabled) {
    this.panel.querySelectorAll('input[type="range"], input[type="number"]').forEach(i => {
      i.disabled = !enabled;
    });
  }
  init() {
    this.panel.querySelector('.control-header')?.addEventListener('click', () =>
      this.panel.classList.toggle('collapsed'));
    this.panel.querySelectorAll('.control-section-header').forEach(h => {
      h.addEventListener('click', e => {
        e.stopPropagation();
        h.parentElement.classList.toggle('expanded');
      });
    });
    this.panel.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
      const valDisp = input.closest('.control-input-wrapper')?.querySelector('.control-value');
      if (valDisp) valDisp.textContent = input.value;
      input.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) {
          this.simulationParams[input.name] = v;
          if (valDisp) valDisp.textContent = v;
          this.callbacks.forEach(cb => cb(this.simulationParams));
        }
      });
    });
    const realToggle = this.panel.querySelector('#realMode');
    const spinner = this.panel.querySelector('#real-mode-spinner');
    const errMsg = this.panel.querySelector('#real-mode-error');
    realToggle?.addEventListener('change', async e => {
      const isReal = e.target.checked;
      this.simulationParams.realMode = isReal;
      this.setInputsEnabled(!isReal);
      if (!isReal) {
        spinner?.classList.remove('active');
        errMsg?.classList.remove('active');
        this.callbacks.forEach(cb => cb(this.simulationParams));
        return;
      }
      spinner?.classList.add('active');
      errMsg?.classList.remove('active');
      try {
        const donki = new DonkiAPI();
        const latest = await donki.getCMEAnalysis();
        if (latest) {
          this.updateValues({
            windSpeed: latest.speed ?? this.simulationParams.windSpeed,
            density: latest.density ?? this.simulationParams.density,
            bz: latest.bz ?? this.simulationParams.bz,
            emissionInterval: this.simulationParams.emissionInterval
          });
        }
      } catch (err) {
        console.error('DONKI error', err);
        realToggle.checked = false;
        this.simulationParams.realMode = false;
        this.setInputsEnabled(true);
        if (errMsg) {
          errMsg.textContent = 'Failed to fetch real-time CME.';
          errMsg.classList.add('active');
        }
      } finally {
        spinner?.classList.remove('active');
      }
    });
  }
}
