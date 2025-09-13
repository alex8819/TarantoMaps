class TarantoDistrictsMap {
    constructor(containerId = 'map', options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.districtsLayer = null;
        this.currentMarker = null;
        this.isLegendVisible = true;
        this.autocompleteContainer = null;

        // Options for data source
        this.useRealData = options.useRealData !== false; // Default to true
        this.quartieriData = this.useRealData ? realQuartieriData : quartieriData;

        // Load persistent data from localStorage if available
        this.loadPersistedData();

        this.init();
    }

    // Funzione per migrare dati esistenti e gestire vie omonime
    migrateDuplicateStreets() {
        console.log('Checking for duplicate street names and migrating data...');

        const savedStreets = localStorage.getItem('tarantoStreetsData');
        if (!savedStreets) return;

        try {
            const originalData = JSON.parse(savedStreets);
            const migratedData = {};
            const streetsByName = {};

            // Prima passata: identifica vie omonime
            Object.entries(originalData).forEach(([streetKey, data]) => {
                const baseName = streetKey.includes('(') ? streetKey.split('(')[0].trim() : streetKey;

                if (!streetsByName[baseName]) {
                    streetsByName[baseName] = [];
                }
                streetsByName[baseName].push({ key: streetKey, data });
            });

            // Seconda passata: crea chiavi appropriate
            Object.entries(streetsByName).forEach(([baseName, streets]) => {
                if (streets.length === 1) {
                    // Via unica, mantieni nome originale
                    const street = streets[0];
                    migratedData[baseName] = street.data;
                } else {
                    // Vie omonime, aggiungi quartiere alla chiave
                    console.log(`Found duplicate street: ${baseName} in ${streets.length} locations`);
                    streets.forEach(street => {
                        const district = street.data.district;
                        if (district && district !== 'Non assegnato') {
                            const newKey = `${baseName} (${district})`;
                            migratedData[newKey] = street.data;
                            console.log(`Migrated: ${baseName} → ${newKey}`);
                        } else {
                            // Se non ha quartiere, mantieni nome base ma aggiungi un identificatore
                            const newKey = street.key !== baseName ? street.key : `${baseName} (Posizione ${streets.indexOf(street) + 1})`;
                            migratedData[newKey] = street.data;
                        }
                    });
                }
            });

            // Salva dati migrati
            localStorage.setItem('tarantoStreetsData', JSON.stringify(migratedData));
            console.log(`Migration completed: ${Object.keys(originalData).length} → ${Object.keys(migratedData).length} streets`);

            return migratedData;
        } catch (error) {
            console.error('Error during migration:', error);
            return null;
        }
    }

    // Carica dati persistenti dal localStorage
    loadPersistedData() {
        try {
            // Prima esegui migrazione per gestire vie omonime
            const migratedData = this.migrateDuplicateStreets();

            // Carica database vie se esistente
            const savedStreets = localStorage.getItem('tarantoStreetsData');
            if (savedStreets) {
                const parsedStreets = JSON.parse(savedStreets);
                console.log(`Loaded ${Object.keys(parsedStreets).length} persistent streets from localStorage`);

                // Combina dati salvati con dati originali
                this.streetsData = this.useRealData ?
                    { ...realStreetsData, ...parsedStreets } :
                    { ...streetsData, ...parsedStreets };

                // Mostra notifica di caricamento
                this.showPersistenceNotification(`🔄 Database caricato: ${Object.keys(parsedStreets).length} vie salvate`);
            } else {
                // Usa dati originali
                this.streetsData = this.useRealData ? realStreetsData : streetsData;
                console.log('No persistent data found, using default street data');
            }

            // Carica confini personalizzati se esistenti
            const savedBoundaries = localStorage.getItem('tarantoQuartieriData');
            if (savedBoundaries) {
                const parsedBoundaries = JSON.parse(savedBoundaries);
                console.log('Loaded persistent district boundaries from localStorage');
                this.quartieriData = parsedBoundaries;
                this.showPersistenceNotification('🗺️ Confini personalizzati caricati');
            }

            // Carica metadati del database
            const savedMetadata = localStorage.getItem('tarantoDataMetadata');
            if (savedMetadata) {
                this.dataMetadata = JSON.parse(savedMetadata);
                console.log('Database metadata loaded:', this.dataMetadata);
            }

        } catch (error) {
            console.error('Error loading persistent data:', error);
            // Fallback ai dati originali in caso di errore
            this.streetsData = this.useRealData ? realStreetsData : streetsData;
            this.showPersistenceNotification('⚠️ Errore caricamento dati salvati, uso dati originali', 'error');
        }
    }

    // Mostra notifiche di persistenza
    showPersistenceNotification(message, type = 'info') {
        // Crea elemento notifica
        const notification = document.createElement('div');
        notification.className = `persistence-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: opacity 0.3s;
        `;

        document.body.appendChild(notification);

        // Rimuovi dopo 3 secondi
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    init() {
        this.initMap();
        this.loadDistricts();
        this.setupEventListeners();
        this.createLegend();
    }

    initMap() {
        // Initialize Leaflet map centered on Taranto
        this.map = L.map(this.containerId).setView([40.4738, 17.2300], 12);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(this.map);

        // Add scale control
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(this.map);
    }

    loadDistricts() {
        // Create districts layer with styling
        this.districtsLayer = L.geoJSON(this.quartieriData, {
            style: (feature) => ({
                fillColor: feature.properties.color,
                weight: 2,
                opacity: 1,
                color: '#333',
                fillOpacity: 0.6
            }),
            onEachFeature: (feature, layer) => {
                // Create popup content
                const popupContent = `
                    <div class="popup-district-name">${feature.properties.name}</div>
                    <div class="popup-info">${feature.properties.description}</div>
                    <div class="popup-info">${feature.properties.population}</div>
                    ${feature.properties.area_km2 ? `<div class="popup-info">Area: ${feature.properties.area_km2} km²</div>` : ''}
                    ${feature.properties.main_streets ? `<div class="popup-info">Vie principali: ${feature.properties.main_streets.slice(0, 3).join(', ')}</div>` : ''}
                `;

                layer.bindPopup(popupContent);

                // Add hover effects
                layer.on({
                    mouseover: (e) => {
                        const layer = e.target;
                        layer.setStyle({
                            weight: 3,
                            fillOpacity: 0.8
                        });
                    },
                    mouseout: (e) => {
                        this.districtsLayer.resetStyle(e.target);
                    }
                });
            }
        }).addTo(this.map);

        // Fit map to districts bounds
        this.map.fitBounds(this.districtsLayer.getBounds(), { padding: [20, 20] });
    }

    createLegend() {
        const legendItems = document.getElementById('legendItems');

        this.quartieriData.features.forEach(feature => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';

            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = feature.properties.color;

            const name = document.createElement('span');
            name.textContent = feature.properties.name;

            legendItem.appendChild(colorBox);
            legendItem.appendChild(name);
            legendItems.appendChild(legendItem);

            // Make legend items clickable
            legendItem.style.cursor = 'pointer';
            legendItem.addEventListener('click', () => {
                this.focusOnDistrict(feature.properties.name);
            });
        });
    }

    focusOnDistrict(districtName) {
        const feature = this.quartieriData.features.find(f => f.properties.name === districtName);
        if (feature) {
            const bounds = L.geoJSON(feature).getBounds();
            this.map.fitBounds(bounds, { padding: [50, 50] });

            // Open popup for the district
            this.districtsLayer.eachLayer(layer => {
                if (layer.feature.properties.name === districtName) {
                    layer.openPopup();
                }
            });
        }
    }

    async searchStreet(streetName) {
        try {
            // First check our local street data
            const localResult = this.searchLocalStreets(streetName);
            if (localResult) {
                return localResult;
            }

            // If not found locally, use Nominatim API for geocoding
            const nominatimResult = await this.searchWithNominatim(streetName);
            return nominatimResult;

        } catch (error) {
            console.error('Error searching street:', error);
            throw new Error('Errore durante la ricerca. Riprova più tardi.');
        }
    }

    searchLocalStreets(streetName) {
        // Usa sempre i dati locali aggiornati con ricerca fuzzy migliorata
        const suggestions = this.getSuggestions(streetName);
        if (suggestions.length > 0) {
            const bestMatch = suggestions[0];
            const streetData = this.streetsData[bestMatch];

            // Se è una via con quartiere, mostra il nome base per user-friendly display
            const displayName = bestMatch.includes('(') ? bestMatch.split('(')[0].trim() : bestMatch;
            const districtInfo = bestMatch.includes('(') ? bestMatch.match(/\((.*?)\)/)?.[1] : streetData.district;

            return {
                address: displayName,
                district: districtInfo || streetData.district,
                coordinates: streetData.coordinates,
                source: 'local',
                confidence: 'high',
                fullKey: bestMatch // Mantieni la chiave completa per riferimenti interni
            };
        }

        // Fallback to simple search
        const searchTerm = streetName.toLowerCase().trim();
        for (const [street, data] of Object.entries(this.streetsData)) {
            if (street.toLowerCase().includes(searchTerm)) {
                return {
                    address: street,
                    district: data.district,
                    coordinates: data.coordinates,
                    source: 'local'
                };
            }
        }
        return null;
    }

    async searchWithNominatim(streetName) {
        const query = `${streetName}, Taranto, Italy`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=it`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'TarantoDistrictsMap/1.0'
            }
        });

        if (!response.ok) {
            throw new Error('Errore nella ricerca');
        }

        const results = await response.json();

        if (results.length === 0) {
            return null;
        }

        // Get the best result (first one from Nominatim)
        const result = results[0];
        const coordinates = [parseFloat(result.lat), parseFloat(result.lon)];

        // Check if coordinates are within Taranto area (rough bounds)
        if (coordinates[0] < 40.3 || coordinates[0] > 40.7 ||
            coordinates[1] < 17.0 || coordinates[1] > 17.5) {
            return null;
        }

        // Find which district contains this point
        const district = this.findDistrictForCoordinates(coordinates);

        return {
            address: result.display_name.split(',')[0],
            district: district,
            coordinates: coordinates,
            source: 'nominatim'
        };
    }

    findDistrictForCoordinates(coordinates) {
        const point = turf.point([coordinates[1], coordinates[0]]); // Note: turf expects [lon, lat]

        for (const feature of this.quartieriData.features) {
            const polygon = turf.polygon(feature.geometry.coordinates);
            if (turf.booleanPointInPolygon(point, polygon)) {
                return feature.properties.name;
            }
        }

        return "Zona non identificata";
    }

    showSearchResult(result) {
        const resultsDiv = document.getElementById('searchResults');
        const resultText = document.getElementById('resultText');
        const districtName = document.getElementById('districtName');

        if (!result) {
            resultText.textContent = "Via non trovata nella zona di Taranto";
            districtName.textContent = "";
            resultsDiv.className = 'results error';
        } else {
            resultText.textContent = `${result.address} appartiene al quartiere:`;
            districtName.textContent = result.district;
            resultsDiv.className = 'results';

            // Add marker to map
            if (this.currentMarker) {
                this.map.removeLayer(this.currentMarker);
            }

            this.currentMarker = L.marker(result.coordinates)
                .addTo(this.map)
                .bindPopup(`<b>${result.address}</b><br>Quartiere: ${result.district}`)
                .openPopup();

            // Focus on the location
            this.map.setView(result.coordinates, 15);
        }

        resultsDiv.style.display = 'block';
    }

    clearSearch() {
        document.getElementById('streetSearch').value = '';
        document.getElementById('searchResults').style.display = 'none';

        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
            this.currentMarker = null;
        }

        // Reset map view to show all districts
        this.map.fitBounds(this.districtsLayer.getBounds(), { padding: [20, 20] });
    }

    toggleLegend() {
        const legend = document.querySelector('.legend');
        const toggleButton = document.getElementById('toggleLegend');

        if (this.isLegendVisible) {
            legend.style.display = 'none';
            toggleButton.textContent = 'Mostra Legenda';
            this.isLegendVisible = false;
        } else {
            legend.style.display = 'block';
            toggleButton.textContent = 'Nascondi Legenda';
            this.isLegendVisible = true;
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('streetSearch');
        const searchButton = document.getElementById('searchButton');
        const clearButton = document.getElementById('clearButton');
        const toggleButton = document.getElementById('toggleLegend');

        // Setup autocomplete
        this.setupAutocomplete(searchInput);

        // Search functionality
        searchButton.addEventListener('click', async () => {
            const streetName = searchInput.value.trim();
            if (!streetName) {
                alert('Inserisci il nome di una via');
                return;
            }

            // Show loading state
            searchButton.disabled = true;
            searchButton.innerHTML = 'Cercando... <div class="loading"></div>';

            try {
                const result = await this.searchStreet(streetName);
                this.showSearchResult(result);
                this.hideAutocomplete();
            } catch (error) {
                this.showSearchResult(null);
                console.error('Search error:', error);
            } finally {
                searchButton.disabled = false;
                searchButton.textContent = 'Cerca';
            }
        });

        // Search on Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.hideAutocomplete();
                searchButton.click();
            }
        });

        // Clear functionality
        clearButton.addEventListener('click', () => {
            this.clearSearch();
            this.hideAutocomplete();
        });

        // Legend toggle
        toggleButton.addEventListener('click', () => {
            this.toggleLegend();
        });

        // Admin tools
        this.setupAdminTools();
    }

    // Public API for integration in other projects
    getMap() {
        return this.map;
    }

    getDistricts() {
        return this.quartieriData.features.map(f => f.properties);
    }

    async findDistrictByStreet(streetName) {
        const result = await this.searchStreet(streetName);
        return result ? result.district : null;
    }

    // Autocomplete functionality
    setupAutocomplete(input) {
        // Create autocomplete container
        this.autocompleteContainer = document.createElement('div');
        this.autocompleteContainer.className = 'autocomplete-container';
        this.autocompleteContainer.style.display = 'none';
        input.parentNode.appendChild(this.autocompleteContainer);

        // Setup input event listener
        let debounceTimer;
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleAutocompleteInput(e.target.value);
            }, 300);
        });

        // Hide autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !this.autocompleteContainer.contains(e.target)) {
                this.hideAutocomplete();
            }
        });
    }

    handleAutocompleteInput(value) {
        if (!value || value.length < 2) {
            this.hideAutocomplete();
            return;
        }

        const suggestions = this.getSuggestions(value);
        this.showSuggestions(suggestions.slice(0, 8)); // Limit to 8 suggestions
    }

    getSuggestions(query) {
        // Sempre usa i dati locali aggiornati con ricerca fuzzy migliorata
        const lowerQuery = query.toLowerCase();
        return Object.keys(this.streetsData)
            .filter(streetKey => {
                const lowerStreet = streetKey.toLowerCase();
                // Ricerca sia nel nome completo che nel nome base (senza quartiere)
                const baseName = streetKey.includes('(') ? streetKey.split('(')[0].trim() : streetKey;
                const lowerBaseName = baseName.toLowerCase();

                return lowerStreet.includes(lowerQuery) ||
                       lowerBaseName.includes(lowerQuery) ||
                       lowerQuery.split(' ').every(word => lowerStreet.includes(word));
            })
            .sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();

                // Estrai nome base per confronto
                const aBase = a.includes('(') ? a.split('(')[0].trim() : a;
                const bBase = b.includes('(') ? b.split('(')[0].trim() : b;

                const aIndex = aLower.indexOf(lowerQuery);
                const bIndex = bLower.indexOf(lowerQuery);
                const aBaseIndex = aBase.toLowerCase().indexOf(lowerQuery);
                const bBaseIndex = bBase.toLowerCase().indexOf(lowerQuery);

                // Prioritizza match esatti all'inizio del nome base
                if (aBaseIndex === 0 && bBaseIndex !== 0) return -1;
                if (bBaseIndex === 0 && aBaseIndex !== 0) return 1;
                if (aBaseIndex === 0 && bBaseIndex === 0) {
                    // Se entrambi iniziano con la query, ordina per nome base poi per quartiere
                    const baseCompare = aBase.localeCompare(bBase);
                    return baseCompare !== 0 ? baseCompare : a.localeCompare(b);
                }

                // Poi per posizione del match
                if (aIndex !== bIndex && aIndex >= 0 && bIndex >= 0) {
                    return aIndex - bIndex;
                }

                return a.localeCompare(b);
            });
    }

    showSuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.hideAutocomplete();
            return;
        }

        this.autocompleteContainer.innerHTML = '';
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';

            const streetData = this.streetsData[suggestion];
            item.innerHTML = `
                <div class="street-name">${suggestion}</div>
                <div class="district-hint">${streetData ? streetData.district : 'Quartiere sconosciuto'}</div>
            `;

            item.addEventListener('click', () => {
                document.getElementById('streetSearch').value = suggestion;
                this.hideAutocomplete();
                document.getElementById('searchButton').click();
            });

            this.autocompleteContainer.appendChild(item);
        });

        this.autocompleteContainer.style.display = 'block';
    }

    hideAutocomplete() {
        if (this.autocompleteContainer) {
            this.autocompleteContainer.style.display = 'none';
        }
    }

    // Enhanced public API
    getStats() {
        // Sempre usa i dati locali aggiornati invece di QuartieriUtils
        const totalPopulation = this.quartieriData.features
            .reduce((sum, feature) => {
                const pop = feature.properties.population ? feature.properties.population.match(/\d+/) : null;
                return sum + (pop ? parseInt(pop[0]) * 1000 : 0);
            }, 0);

        return {
            totalDistricts: this.quartieriData.features.length,
            totalStreets: Object.keys(this.streetsData).length,
            totalPopulation: totalPopulation,
            averagePopulationPerDistrict: totalPopulation > 0 ? Math.round(totalPopulation / this.quartieriData.features.length) : 0,
            dataSource: this.useRealData ? 'real' : 'demo'
        };
    }

    getStreetsByDistrict(districtName) {
        // Sempre usa i dati locali aggiornati invece di QuartieriUtils
        return Object.entries(this.streetsData)
            .filter(([street, data]) => data.district === districtName)
            .map(([street, data]) => street);
    }

    // Admin tools functionality
    setupAdminTools() {
        document.getElementById('collectDataBtn').addEventListener('click', () => {
            this.showCollectDataPanel();
        });

        document.getElementById('validateDataBtn').addEventListener('click', () => {
            this.showValidationPanel();
        });

        document.getElementById('statsBtn').addEventListener('click', () => {
            this.showStatsPanel();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.showExportPanel();
        });

        document.getElementById('closeAdminBtn').addEventListener('click', () => {
            this.hideAdminPanel();
        });
    }

    showAdminPanel(title, content) {
        document.getElementById('adminTitle').textContent = title;
        document.getElementById('adminContent').innerHTML = content;
        document.getElementById('adminPanel').style.display = 'block';
    }

    hideAdminPanel() {
        document.getElementById('adminPanel').style.display = 'none';
    }

    async showCollectDataPanel() {
        const content = `
            <div class="data-grid">
                <div class="data-card">
                    <button id="collectStreetsBtn" class="btn-admin">🛣️ Raccogli Vie</button>
                    <div class="data-label">Da OpenStreetMap</div>
                </div>
                <div class="data-card">
                    <button id="collectBoundariesBtn" class="btn-admin">🗺️ Raccogli Confini</button>
                    <div class="data-label">Confini amministrativi</div>
                </div>
                <div class="data-card">
                    <button id="generateBoundariesBtn" class="btn-admin">🎯 Genera Confini</button>
                    <div class="data-label">Da vie raccolte</div>
                </div>
            </div>
            <div id="collectProgress" style="display: none;">
                <div class="progress-mini">
                    <div class="progress-bar" id="collectProgressBar"></div>
                </div>
                <div id="collectStatus">Pronto per iniziare</div>
            </div>
            <div id="collectResults"></div>
        `;

        this.showAdminPanel('🔄 Raccolta Dati', content);

        document.getElementById('collectStreetsBtn').addEventListener('click', () => {
            this.collectStreetsData();
        });

        document.getElementById('collectBoundariesBtn').addEventListener('click', () => {
            this.collectBoundariesData();
        });

        document.getElementById('generateBoundariesBtn').addEventListener('click', () => {
            this.generateBoundariesFromStreets();
        });
    }

    async collectStreetsData() {
        const progressDiv = document.getElementById('collectProgress');
        const progressBar = document.getElementById('collectProgressBar');
        const statusDiv = document.getElementById('collectStatus');
        const resultsDiv = document.getElementById('collectResults');

        progressDiv.style.display = 'block';
        statusDiv.textContent = 'Raccogliendo vie da OpenStreetMap...';
        progressBar.style.width = '10%';

        try {
            if (typeof TarantoDataCollector === 'undefined') {
                throw new Error('TarantoDataCollector non disponibile');
            }

            const collector = new TarantoDataCollector();

            // Usa la raccolta completa invece di quella semplice
            progressBar.style.width = '30%';
            statusDiv.textContent = 'Raccogliendo tutte le vie...';

            const completeData = await collector.fetchCompleteStreetData();

            progressBar.style.width = '100%';
            statusDiv.textContent = `Raccolte ${completeData.length} vie complete con numeri civici e CAP!`;

            resultsDiv.innerHTML = `
                <h4>Dati Raccolti:</h4>
                <div class="data-grid">
                    <div class="data-card">
                        <div class="data-number">${completeData.length}</div>
                        <div class="data-label">Vie Totali</div>
                    </div>
                    <div class="data-card">
                        <div class="data-number">${completeData.filter(s => s.hasAddressData).length}</div>
                        <div class="data-label">Con Numeri Civici</div>
                    </div>
                    <div class="data-card">
                        <div class="data-number">${completeData.filter(s => s.postcodes && s.postcodes.length > 0).length}</div>
                        <div class="data-label">Con CAP</div>
                    </div>
                    <div class="data-card">
                        <div class="data-number">${completeData.reduce((sum, s) => sum + (s.houseNumbers ? s.houseNumbers.length : 0), 0)}</div>
                        <div class="data-label">Numeri Civici Tot.</div>
                    </div>
                </div>
                <h5>Anteprima Vie:</h5>
                <div class="validation-results" style="max-height: 200px;">
                    ${completeData.slice(0, 10).map(s => `
                        <div class="validation-item">
                            <span>${s.name}</span>
                            <span>
                                ${s.numberRange && s.numberRange.total > 0 ?
                                    `${s.numberRange.min}-${s.numberRange.max} (${s.numberRange.total} civici)` :
                                    'Senza civici'}
                                ${s.postcodes && s.postcodes.length > 0 ? ` | CAP: ${s.postcodes.join(', ')}` : ''}
                            </span>
                        </div>
                    `).join('')}
                    ${completeData.length > 10 ?
                        `<div class="validation-item"><span>... e altre ${completeData.length - 10} vie</span><span></span></div>` :
                        ''}
                </div>
                <div style="margin-top: 15px;">
                    <button id="saveStreetsBtn" class="btn-admin">💾 Salva nel Database</button>
                    <button id="exportCompleteBtn" class="btn-admin">📄 Esporta Dati Completi</button>
                </div>
            `;

            document.getElementById('saveStreetsBtn').addEventListener('click', () => {
                this.saveCollectedStreets(completeData);
            });

            document.getElementById('exportCompleteBtn').addEventListener('click', () => {
                this.exportCompleteStreetData(completeData);
            });

        } catch (error) {
            statusDiv.textContent = 'Errore nella raccolta: ' + error.message;
            progressBar.style.width = '0%';
        }
    }

    async collectBoundariesData() {
        const progressDiv = document.getElementById('collectProgress');
        const progressBar = document.getElementById('collectProgressBar');
        const statusDiv = document.getElementById('collectStatus');
        const resultsDiv = document.getElementById('collectResults');

        progressDiv.style.display = 'block';
        statusDiv.textContent = 'Raccogliendo confini amministrativi...';
        progressBar.style.width = '10%';

        try {
            if (typeof TarantoDataCollector === 'undefined') {
                throw new Error('TarantoDataCollector non disponibile');
            }

            const collector = new TarantoDataCollector();
            const districts = await collector.fetchDistrictBoundaries();

            progressBar.style.width = '100%';
            statusDiv.textContent = `Raccolti ${districts.length} confini amministrativi!`;

            resultsDiv.innerHTML = `
                <h4>Risultati:</h4>
                <ul>
                    ${districts.slice(0, 10).map(d => `<li>${d.name} (livello ${d.admin_level})</li>`).join('')}
                    ${districts.length > 10 ? `<li>... e altri ${districts.length - 10} confini</li>` : ''}
                </ul>
                <button id="saveBoundariesBtn" class="btn-admin">💾 Aggiorna Confini</button>
            `;

            document.getElementById('saveBoundariesBtn').addEventListener('click', () => {
                this.saveCollectedBoundaries(districts);
            });

        } catch (error) {
            statusDiv.textContent = 'Errore nella raccolta: ' + error.message;
            progressBar.style.width = '0%';
        }
    }

    showValidationPanel() {
        const content = `
            <div class="data-grid">
                <div class="data-card">
                    <button id="validateBoundariesBtn" class="btn-admin">🎯 Test Confini</button>
                    <div class="data-label">Accuratezza poligoni</div>
                </div>
                <div class="data-card">
                    <button id="validateStreetsBtn" class="btn-admin">📍 Test Vie</button>
                    <div class="data-label">Coordinate e assegnazioni</div>
                </div>
            </div>
            <div id="validationProgress" style="display: none;">
                <div class="progress-mini">
                    <div class="progress-bar" id="validationProgressBar"></div>
                </div>
                <div id="validationStatus">Pronto per iniziare</div>
            </div>
            <div class="validation-results" id="validationResults"></div>
        `;

        this.showAdminPanel('🧪 Validazione Dati', content);

        document.getElementById('validateBoundariesBtn').addEventListener('click', () => {
            this.validateBoundaries();
        });

        document.getElementById('validateStreetsBtn').addEventListener('click', () => {
            this.validateStreets();
        });
    }

    async validateBoundaries() {
        const progressDiv = document.getElementById('validationProgress');
        const progressBar = document.getElementById('validationProgressBar');
        const statusDiv = document.getElementById('validationStatus');
        const resultsDiv = document.getElementById('validationResults');

        progressDiv.style.display = 'block';
        resultsDiv.innerHTML = '';

        const features = this.quartieriData.features;

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            const district = feature.properties.name;

            const progress = ((i + 1) / features.length) * 100;
            progressBar.style.width = progress + '%';
            statusDiv.textContent = `Testando: ${district}`;

            try {
                const polygon = turf.polygon(feature.geometry.coordinates);
                const area = turf.area(polygon);

                const districtStreets = Object.entries(this.streetsData)
                    .filter(([street, data]) => data.district === district);

                let streetsInBoundary = 0;
                let streetsOutBoundary = 0;

                for (const [street, data] of districtStreets) {
                    const point = turf.point([data.coordinates[1], data.coordinates[0]]);
                    if (turf.booleanPointInPolygon(point, polygon)) {
                        streetsInBoundary++;
                    } else {
                        streetsOutBoundary++;
                    }
                }

                const accuracy = districtStreets.length > 0 ?
                    (streetsInBoundary / districtStreets.length) * 100 : 100;

                let status = 'success';
                if (accuracy < 80) status = 'warning';
                if (accuracy < 50) status = 'error';

                const resultItem = document.createElement('div');
                resultItem.className = `validation-item ${status}`;
                resultItem.innerHTML = `
                    <span>${district}</span>
                    <span>${accuracy.toFixed(1)}% (${streetsInBoundary}/${districtStreets.length})</span>
                `;
                resultsDiv.appendChild(resultItem);

            } catch (error) {
                const resultItem = document.createElement('div');
                resultItem.className = 'validation-item error';
                resultItem.innerHTML = `<span>${district}</span><span>Errore: ${error.message}</span>`;
                resultsDiv.appendChild(resultItem);
            }

            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        statusDiv.textContent = 'Validazione completata';
    }

    async validateStreets() {
        const progressDiv = document.getElementById('validationProgress');
        const progressBar = document.getElementById('validationProgressBar');
        const statusDiv = document.getElementById('validationStatus');
        const resultsDiv = document.getElementById('validationResults');

        progressDiv.style.display = 'block';
        resultsDiv.innerHTML = '';

        const streets = Object.entries(this.streetsData);
        let validStreets = 0;
        let invalidCoords = 0;
        let orphanStreets = 0;

        for (let i = 0; i < streets.length; i++) {
            const [street, data] = streets[i];

            const progress = ((i + 1) / streets.length) * 100;
            progressBar.style.width = progress + '%';
            statusDiv.textContent = `Testando: ${street}`;

            // Test coordinates
            const coords = data.coordinates;
            const coordsValid = coords && coords.length === 2 &&
                coords[0] >= 40.3 && coords[0] <= 40.7 &&
                coords[1] >= 17.0 && coords[1] <= 17.5;

            // Test district exists
            const districtExists = this.quartieriData.features.some(
                f => f.properties.name === data.district
            );

            if (coordsValid && districtExists) {
                validStreets++;
            } else {
                if (!coordsValid) invalidCoords++;
                if (!districtExists) orphanStreets++;
            }

            await new Promise(resolve => setTimeout(resolve, 10));
        }

        const results = [
            { label: 'Vie Valide', value: validStreets, status: 'success' },
            { label: 'Coordinate Invalide', value: invalidCoords, status: invalidCoords > 0 ? 'warning' : 'success' },
            { label: 'Quartieri Inesistenti', value: orphanStreets, status: orphanStreets > 0 ? 'error' : 'success' }
        ];

        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = `validation-item ${result.status}`;
            resultItem.innerHTML = `
                <span>${result.label}</span>
                <span>${result.value}</span>
            `;
            resultsDiv.appendChild(resultItem);
        });

        statusDiv.textContent = 'Validazione vie completata';
    }

    showStatsPanel() {
        const stats = this.getStats();
        const districtStats = this.quartieriData.features.map(f => ({
            name: f.properties.name,
            streets: this.getStreetsByDistrict(f.properties.name).length,
            area: f.properties.area_km2 || 'N/A'
        }));

        const content = `
            <div class="data-grid">
                <div class="data-card">
                    <div class="data-number">${stats.totalDistricts}</div>
                    <div class="data-label">Quartieri</div>
                </div>
                <div class="data-card">
                    <div class="data-number">${stats.totalStreets}</div>
                    <div class="data-label">Vie nel DB</div>
                </div>
                <div class="data-card">
                    <div class="data-number">${stats.totalPopulation || 'N/A'}</div>
                    <div class="data-label">Popolazione Tot.</div>
                </div>
                <div class="data-card">
                    <div class="data-number">${(stats.totalStreets / stats.totalDistricts).toFixed(1)}</div>
                    <div class="data-label">Vie per Quartiere</div>
                </div>
            </div>
            <h4>Dettagli per Quartiere:</h4>
            <div class="validation-results">
                ${districtStats.map(d => `
                    <div class="validation-item">
                        <span>${d.name}</span>
                        <span>${d.streets} vie • ${d.area} km²</span>
                    </div>
                `).join('')}
            </div>
        `;

        this.showAdminPanel('📊 Statistiche', content);
    }

    showExportPanel() {
        const content = `
            <div class="data-grid">
                <div class="data-card">
                    <button id="exportJSONBtn" class="btn-admin">📄 Esporta JSON</button>
                    <div class="data-label">Tutti i dati</div>
                </div>
                <div class="data-card">
                    <button id="exportGeoJSONBtn" class="btn-admin">🗺️ Esporta GeoJSON</button>
                    <div class="data-label">Solo geometrie</div>
                </div>
                <div class="data-card">
                    <button id="exportCSVBtn" class="btn-admin">📊 Esporta CSV</button>
                    <div class="data-label">Lista vie</div>
                </div>
            </div>
            <textarea id="exportPreview" style="width: 100%; height: 200px; margin-top: 15px;" placeholder="L'anteprima dell'esportazione apparirà qui..."></textarea>
        `;

        this.showAdminPanel('💾 Esportazione', content);

        document.getElementById('exportJSONBtn').addEventListener('click', () => {
            this.exportJSON();
        });

        document.getElementById('exportGeoJSONBtn').addEventListener('click', () => {
            this.exportGeoJSON();
        });

        document.getElementById('exportCSVBtn').addEventListener('click', () => {
            this.exportCSV();
        });
    }

    exportJSON() {
        const data = {
            metadata: {
                generated: new Date().toISOString(),
                source: 'TarantoDistrictsMap',
                version: '2.0'
            },
            quartieri: this.quartieriData,
            vie: this.streetsData,
            stats: this.getStats()
        };

        const jsonStr = JSON.stringify(data, null, 2);
        document.getElementById('exportPreview').value = jsonStr;

        this.downloadFile(jsonStr, 'taranto-data.json', 'application/json');
    }

    exportGeoJSON() {
        const geojson = {
            type: 'FeatureCollection',
            features: this.quartieriData.features
        };

        const jsonStr = JSON.stringify(geojson, null, 2);
        document.getElementById('exportPreview').value = jsonStr;

        this.downloadFile(jsonStr, 'taranto-quartieri.geojson', 'application/json');
    }

    exportCSV() {
        const headers = ['Via', 'Quartiere', 'Latitudine', 'Longitudine'];
        const rows = Object.entries(this.streetsData).map(([street, data]) => [
            street,
            data.district,
            data.coordinates[0],
            data.coordinates[1]
        ]);

        const csv = [headers, ...rows].map(row =>
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');

        document.getElementById('exportPreview').value = csv;

        this.downloadFile(csv, 'taranto-vie.csv', 'text/csv');
    }

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }

    saveCollectedStreets(completeData) {
        try {
            console.log('Saving complete street data:', completeData);

            // Aggiorna il database locale delle vie
            const newStreetsData = {};

            completeData.forEach(street => {
                // Determina il quartiere per la via
                let assignedDistrict = 'Non assegnato';

                // 1. Se ha quartieri dai dati OSM, usa il primo
                if (street.districts && street.districts.length > 0) {
                    assignedDistrict = street.districts[0];
                }
                // 2. Altrimenti usa il quartiere esistente se la via esiste già
                else if (this.streetsData[street.name]) {
                    assignedDistrict = this.streetsData[street.name].district;
                }
                // 3. Altrimenti prova a determinare il quartiere dalle coordinate usando i confini attuali
                else if (street.centroid || (street.coordinates && street.coordinates.length > 0)) {
                    const coords = street.centroid ?
                        [street.centroid.lat, street.centroid.lon] :
                        street.coordinates;

                    const detectedDistrict = this.findDistrictForCoordinates(coords);
                    if (detectedDistrict !== "Zona non identificata") {
                        assignedDistrict = detectedDistrict;
                    }
                }

                // Crea una chiave unica per la via per gestire omonime
                let streetKey = street.name;

                // Se esiste già una via con lo stesso nome ma quartiere diverso, crea chiave composta
                if (newStreetsData[street.name] && newStreetsData[street.name].district !== assignedDistrict) {
                    // Rinomina la via esistente per includere il quartiere
                    const existingStreet = newStreetsData[street.name];
                    const existingDistrict = existingStreet.district;
                    if (existingDistrict !== 'Non assegnato') {
                        const oldKey = street.name;
                        const newExistingKey = `${street.name} (${existingDistrict})`;
                        newStreetsData[newExistingKey] = existingStreet;
                        delete newStreetsData[oldKey];
                    }

                    // Usa chiave composta per la via corrente se ha quartiere
                    if (assignedDistrict !== 'Non assegnato') {
                        streetKey = `${street.name} (${assignedDistrict})`;
                    }
                }

                // Crea l'entry nel database
                newStreetsData[streetKey] = {
                    district: assignedDistrict,
                    coordinates: street.centroid ?
                        [street.centroid.lat, street.centroid.lon] :
                        (street.coordinates && street.coordinates.length > 0 ?
                            street.coordinates :
                            [40.4738, 17.2300]), // Coordinate default di Taranto
                    // Nuovi campi aggiunti
                    type: street.type || 'street',
                    houseNumbers: street.houseNumbers || [],
                    numberRange: street.numberRange || { min: null, max: null, total: 0 },
                    postcodes: street.postcodes || [],
                    hasAddressData: street.hasAddressData || false,
                    osm_id: street.id || null,
                    sourceNote: street.sourceNote || 'OpenStreetMap',
                    lastUpdated: new Date().toISOString()
                };
            });

            // Salva nel localStorage per persistenza
            localStorage.setItem('tarantoStreetsData', JSON.stringify(newStreetsData));

            // Salva metadati del database
            const metadata = {
                lastUpdated: new Date().toISOString(),
                source: 'OpenStreetMap via Overpass API',
                totalStreets: Object.keys(newStreetsData).length,
                version: '2.0'
            };
            localStorage.setItem('tarantoDataMetadata', JSON.stringify(metadata));

            // Aggiorna il database in memoria
            this.streetsData = { ...this.streetsData, ...newStreetsData };
            this.dataMetadata = metadata;

            // Statistiche
            const stats = {
                totalStreets: Object.keys(newStreetsData).length,
                withHouseNumbers: Object.values(newStreetsData).filter(s => s.hasAddressData).length,
                withPostcodes: Object.values(newStreetsData).filter(s => s.postcodes.length > 0).length,
                totalHouseNumbers: Object.values(newStreetsData).reduce((sum, s) => sum + s.numberRange.total, 0),
                districts: [...new Set(Object.values(newStreetsData).map(s => s.district))].length
            };

            alert(`✅ Database aggiornato con successo!\n\n` +
                  `📊 Statistiche:\n` +
                  `• ${stats.totalStreets} vie totali\n` +
                  `• ${stats.withHouseNumbers} vie con numeri civici\n` +
                  `• ${stats.withPostcodes} vie con CAP\n` +
                  `• ${stats.totalHouseNumbers} numeri civici totali\n` +
                  `• ${stats.districts} quartieri identificati\n\n` +
                  `I dati sono stati salvati localmente e sono immediatamente disponibili per la ricerca.`);

            // Ricarica la mappa con i nuovi dati se necessario
            console.log('Updated streets database:', this.streetsData);

        } catch (error) {
            console.error('Error saving streets:', error);
            alert(`❌ Errore nel salvataggio: ${error.message}`);
        }
    }

    exportCompleteStreetData(completeData) {
        try {
            const exportData = {
                metadata: {
                    generated: new Date().toISOString(),
                    source: 'OpenStreetMap + TarantoDistrictsMap',
                    version: '2.0',
                    total_streets: completeData.length,
                    data_types: ['streets', 'house_numbers', 'postcodes', 'districts']
                },
                summary: {
                    total_streets: completeData.length,
                    with_house_numbers: completeData.filter(s => s.hasAddressData).length,
                    with_postcodes: completeData.filter(s => s.postcodes && s.postcodes.length > 0).length,
                    total_house_numbers: completeData.reduce((sum, s) => sum + (s.houseNumbers ? s.houseNumbers.length : 0), 0),
                    postcodes: [...new Set(completeData.flatMap(s => s.postcodes || []))],
                    districts: [...new Set(completeData.flatMap(s => s.districts || []))]
                },
                streets: completeData
            };

            const jsonStr = JSON.stringify(exportData, null, 2);
            this.downloadFile(jsonStr, `taranto-complete-streets-${new Date().toISOString().split('T')[0]}.json`, 'application/json');

            alert('✅ Dati completi esportati in formato JSON!');
        } catch (error) {
            alert(`❌ Errore nell'esportazione: ${error.message}`);
        }
    }

    saveCollectedBoundaries(boundaries) {
        console.log('Boundaries collected:', boundaries);
        alert(`Raccolti ${boundaries.length} confini amministrativi!\n\nPer aggiornare i confini, è necessario implementare la logica di aggiornamento.`);
    }

    async generateBoundariesFromStreets() {
        const progressDiv = document.getElementById('collectProgress');
        const progressBar = document.getElementById('collectProgressBar');
        const statusDiv = document.getElementById('collectStatus');
        const resultsDiv = document.getElementById('collectResults');

        progressDiv.style.display = 'block';
        statusDiv.textContent = 'Generando confini da vie raccolte...';
        progressBar.style.width = '10%';

        try {
            if (typeof BoundaryGenerator === 'undefined') {
                throw new Error('BoundaryGenerator non disponibile');
            }

            // Usa le vie attualmente caricate nel sistema
            const generator = new BoundaryGenerator(this.streetsData);

            statusDiv.textContent = 'Calcolando clustering geografico...';
            progressBar.style.width = '30%';

            // Genera confini usando clustering
            const generatedBoundaries = generator.generateClusteredBoundaries();

            statusDiv.textContent = 'Validando accuratezza confini...';
            progressBar.style.width = '70%';

            // Valida la qualità
            const validation = generator.validateGeneratedBoundaries(generatedBoundaries);

            progressBar.style.width = '100%';
            statusDiv.textContent = `Generati ${generatedBoundaries.features.length} confini! Accuratezza media: ${validation.averageAccuracy.toFixed(1)}%`;

            resultsDiv.innerHTML = `
                <h4>Confini Generati:</h4>
                <div class="validation-results">
                    ${validation.details.map(d => `
                        <div class="validation-item ${d.accuracy > 80 ? 'success' : d.accuracy > 50 ? 'warning' : 'error'}">
                            <span>${d.district}</span>
                            <span>${d.accuracy?.toFixed(1) || 0}% (${d.streetsInBoundary || 0}/${d.totalStreets || 0})</span>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 15px;">
                    <button id="applyBoundariesBtn" class="btn-admin">✅ Applica Confini</button>
                    <button id="exportBoundariesBtn" class="btn-admin">💾 Esporta GeoJSON</button>
                </div>
            `;

            document.getElementById('applyBoundariesBtn').addEventListener('click', () => {
                this.applyGeneratedBoundaries(generatedBoundaries);
            });

            document.getElementById('exportBoundariesBtn').addEventListener('click', () => {
                this.exportGeneratedBoundaries(generatedBoundaries);
            });

        } catch (error) {
            statusDiv.textContent = 'Errore nella generazione: ' + error.message;
            progressBar.style.width = '0%';
            console.error('Boundary generation error:', error);
        }
    }

    applyGeneratedBoundaries(generatedBoundaries) {
        try {
            // Aggiorna i dati del quartiere con i nuovi confini
            if (typeof BoundaryIntegrator !== 'undefined') {
                const integrator = new BoundaryIntegrator(this.quartieriData, generatedBoundaries);
                const newQuartieriData = integrator.mergeBoundaries();

                // Aggiorna la mappa
                this.quartieriData = newQuartieriData;

                // Salva i nuovi confini nel localStorage per persistenza
                localStorage.setItem('tarantoQuartieriData', JSON.stringify(newQuartieriData));
                console.log('Boundaries saved to localStorage for persistence');

                // Rimuovi il layer esistente
                if (this.districtsLayer) {
                    this.map.removeLayer(this.districtsLayer);
                }

                // Ricarica i quartieri con i nuovi confini
                this.loadDistricts();

                // Ricarica la legenda
                document.getElementById('legendItems').innerHTML = '';
                this.createLegend();

                alert(`✅ Confini applicati con successo!\n\nLa mappa ora usa i confini generati dalle vie reali.`);

                // Chiudi il pannello admin
                this.hideAdminPanel();

            } else {
                throw new Error('BoundaryIntegrator non disponibile');
            }

        } catch (error) {
            alert(`❌ Errore nell'applicazione dei confini: ${error.message}`);
            console.error('Apply boundaries error:', error);
        }
    }

    exportGeneratedBoundaries(generatedBoundaries) {
        try {
            if (typeof BoundaryGenerator !== 'undefined') {
                const generator = new BoundaryGenerator(this.streetsData);
                const exportData = generator.exportBoundaries(generatedBoundaries);

                const jsonStr = JSON.stringify(exportData, null, 2);
                this.downloadFile(jsonStr, 'taranto-confini-generati.geojson', 'application/json');

                alert('✅ Confini esportati in formato GeoJSON!');
            }
        } catch (error) {
            alert(`❌ Errore nell'esportazione: ${error.message}`);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance for easy access
    window.tarantoMap = new TarantoDistrictsMap('map');
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TarantoDistrictsMap;
}