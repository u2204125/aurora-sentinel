import { DonkiAPI } from './donki-api.js';

export class ControlPanel {
    constructor(simulationParams) {
        this.panel = document.getElementById('control-panel');
        this.simulationParams = simulationParams;
        this.onParamChangeCallbacks = [];
        if (!this.panel) {
            console.error('Control panel element not found.');
            return;
        }
    }

    // Add callback for parameter changes
    onParamChange(callback) {
        this.onParamChangeCallbacks.push(callback);
    }

    // Update the simulation parameters and UI with new values
    updateValues(newParams) {
        // Update each parameter
        Object.keys(newParams).forEach(key => {
            if (this.simulationParams.hasOwnProperty(key)) {
                this.simulationParams[key] = newParams[key];
                
                // Notify callbacks about parameter updates
                this.onParamChangeCallbacks.forEach(callback => callback(this.simulationParams));
                
                // Update the corresponding UI element
                const input = this.panel.querySelector(`input[name="${key}"]`);
                if (input) {
                    input.value = newParams[key];
                    const valueDisplay = input.closest('.control-input-wrapper')?.querySelector('.control-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = newParams[key];
                    }
                }
            }
        });
    }

    // Enable/disable all parameter inputs
    setInputsEnabled(enabled) {
        this.panel.querySelectorAll('input[type="range"]').forEach(input => {
            input.disabled = !enabled;
        });
    }

    init() {
        const header = this.panel.querySelector('.control-header');
        
        // Toggle panel collapse/expand
        header.addEventListener('click', () => {
            this.panel.classList.toggle('collapsed');
        });

        // Setup section toggles
        this.panel.querySelectorAll('.control-section-header').forEach(sectionHeader => {
            sectionHeader.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent panel from collapsing when clicking section header
                const section = sectionHeader.parentElement;
                section.classList.toggle('expanded');
            });
        });

        // Setup input handlers
        this.panel.querySelectorAll('input[type="range"]').forEach(input => {
            const valueDisplay = input.closest('.control-input-wrapper').querySelector('.control-value');
            if (valueDisplay) {
                valueDisplay.textContent = input.value;
                input.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    valueDisplay.textContent = value;
                    this.simulationParams[input.name] = value;
                    // Notify all callbacks about parameter change
                    this.onParamChangeCallbacks.forEach(callback => callback(this.simulationParams));
                });
            }
        });

        // Setup real-time mode toggle
        const realModeToggle = this.panel.querySelector('#realMode');
        const spinner = this.panel.querySelector('#real-mode-spinner');
        const errorMessage = this.panel.querySelector('#real-mode-error');
        
        if (realModeToggle) {
            realModeToggle.addEventListener('change', async (e) => {
                const isRealMode = e.target.checked;
                this.simulationParams.realMode = isRealMode;
                
                // Toggle input fields
                this.setInputsEnabled(!isRealMode);
                
                if (isRealMode) {
                    // Show loading spinner
                    spinner.classList.add('active');
                    errorMessage.classList.remove('active');
                    
                    try {
                        // Get the latest data from DONKI API
                        const donkiAPI = new DonkiAPI();
                        const cmeData = await donkiAPI.getCMEAnalysis();
                        
                        if (cmeData) {
                            // Update simulation parameters with real data
                            this.updateValues({
                                windSpeed: cmeData.speed || 500,
                                density: cmeData.density || 10,
                                bz: cmeData.bz || -5,
                                // Keep emission interval as is since it's not from real data
                                emissionInterval: this.simulationParams.emissionInterval
                            });
                            
                            // Hide spinner on success
                            spinner.classList.remove('active');
                        } else {
                            throw new Error('Failed to fetch real-time data');
                        }
                    } catch (error) {
                        // Handle error
                        console.error('Error fetching real-time data:', error);
                        realModeToggle.checked = false;
                        this.simulationParams.realMode = false;
                        this.setInputsEnabled(true);
                        
                        // Show error message
                        errorMessage.textContent = 'Failed to load real-time data. Please try again later.';
                        errorMessage.classList.add('active');
                        spinner.classList.remove('active');
                    }
                } else {
                    // Hide spinner and error when turning off real mode
                    spinner.classList.remove('active');
                    errorMessage.classList.remove('active');
                }
            });
        }
    }
}
