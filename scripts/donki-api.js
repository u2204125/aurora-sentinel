// DONKI API endpoints
const DONKI_BASE_URL = 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get';
const CME_ANALYSIS_ENDPOINT = '/CMEAnalysis';

export class DonkiAPI {
    constructor() {
        this.lastFetchTime = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        this.cachedData = null;
    }

    async getCMEAnalysis(startDate = null, endDate = null) {
        try {
            // If we have cached data and it's not expired, return it
            if (this.cachedData && this.lastFetchTime && 
                (Date.now() - this.lastFetchTime < this.cacheTimeout)) {
                return this.cachedData;
            }

            // Format dates for the API
            const today = new Date();
            const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
            
            startDate = startDate || sevenDaysAgo.toISOString().split('T')[0];
            endDate = endDate || today.toISOString().split('T')[0];

            const url = `${DONKI_BASE_URL}${CME_ANALYSIS_ENDPOINT}?startDate=${startDate}&endDate=${endDate}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Cache the results
            this.cachedData = data;
            this.lastFetchTime = Date.now();

            // Process and return the most recent CME data
            return this.processLatestCME(data);
        } catch (error) {
            console.error('Error fetching CME analysis:', error);
            return null;
        }
    }

    processLatestCME(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        // Sort by time to get the most recent CME
        const sortedData = data.sort((a, b) => 
            new Date(b.time21_5) - new Date(a.time21_5)
        );

        const latestCME = sortedData[0];
        
        // Calculate estimated parameters based on CME data
        const density = this.estimatePlasmaDensity(latestCME);
        const bz = this.estimateIMFBz(latestCME);

        // Extract and return all parameters
        return {
            time: latestCME.time21_5,
            speed: latestCME.speed,
            type: latestCME.type,
            latitude: latestCME.latitude,
            longitude: latestCME.longitude,
            halfAngle: latestCME.halfAngle,
            note: latestCME.note,
            isMostEnergetic: latestCME.isMostEnergetic,
            sourceLocation: latestCME.sourceLocation,
            catalog: latestCME.catalog,
            // Add estimated parameters
            density: density,
            bz: bz
        };
    }

    // Estimate plasma density based on CME parameters
    estimatePlasmaDensity(cmeData) {
        if (!cmeData) return 10; // Default value
        
        // Base density on CME energy and angle
        let density = 10; // Base density
        
        if (cmeData.isMostEnergetic) {
            density *= 1.5;
        }
        
        // Wider CMEs tend to have lower density
        if (cmeData.halfAngle > 30) {
            density *= 0.8;
        }
        
        // High-speed CMEs often carry more plasma
        if (cmeData.speed > 1000) {
            density *= 1.3;
        }
        
        // Keep within reasonable bounds
        return Math.max(1, Math.min(20, density));
    }

    // Estimate IMF Bz based on CME parameters
    estimateIMFBz(cmeData) {
        if (!cmeData) return -5; // Default value
        
        // Start with moderate southward IMF
        let bz = -5;
        
        // Strong CMEs tend to have more negative Bz
        if (cmeData.speed > 1000) {
            bz -= 3;
        }
        
        // Very energetic events tend toward stronger negative Bz
        if (cmeData.isMostEnergetic) {
            bz -= 2;
        }
        
        // Keep within reasonable bounds (-15 to +5 nT)
        return Math.max(-15, Math.min(5, bz));
    }

    // Get estimated aurora impact based on CME parameters
    estimateAuroraImpact(cmeData) {
        if (!cmeData) return 'Low';

        // Basic impact estimation based on speed and angle
        const speed = cmeData.speed || 0;
        const halfAngle = cmeData.halfAngle || 0;

        if (speed > 1000 && halfAngle > 30) {
            return 'High';
        } else if (speed > 500 || halfAngle > 20) {
            return 'Medium';
        } else {
            return 'Low';
        }
    }
}
