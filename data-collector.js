// Script per raccogliere dati reali delle vie di Taranto da OpenStreetMap
class TarantoDataCollector {
    constructor() {
        this.overpassUrl = 'https://overpass-api.de/api/interpreter';
        this.streets = [];
        this.districts = [];
    }

    // Query Overpass per ottenere tutte le vie di Taranto (versione migliorata)
    async fetchTarantoStreets() {
        console.log('Fetching ALL streets from OpenStreetMap for Taranto...');

        // Query molto più ampia per raccogliere tutte le vie
        const query = `
            [out:json][timeout:120];
            (
              // Area di Taranto - proviamo diversi metodi
              area[name="Taranto"]["admin_level"~"^(6|8)$"]->.searchArea;
            );
            (
              // Tutte le strade con nome in Taranto
              way["highway"]["name"](area.searchArea);
              // Include anche pedestrian, footway, cycleway se hanno nomi
              way["highway"~"^(pedestrian|footway|cycleway|path)$"]["name"](area.searchArea);
              // Include anche le strade senza classificazione specifica
              way["name"]["highway"](area.searchArea);
            );
            out geom meta;
        `;

        try {
            const response = await fetch(this.overpassUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `data=${encodeURIComponent(query)}`
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Found ${data.elements.length} streets`);

            const streets = this.processStreetData(data.elements);

            // Se abbiamo raccolto poche vie, prova query alternativa
            if (streets.length < 100) {
                console.log(`Only ${streets.length} streets found, trying alternative query...`);
                return await this.fetchTarantoStreetsAlternative();
            }

            return streets;
        } catch (error) {
            console.error('Error fetching street data:', error);
            // Prova query di fallback
            console.log('Trying fallback query...');
            return await this.fetchTarantoStreetsAlternative();
        }
    }

    // Query alternativa con coordinate geografiche invece di area ID
    async fetchTarantoStreetsAlternative() {
        console.log('Using coordinate-based query for Taranto streets...');

        const query = `
            [out:json][timeout:120];
            (
              // Usa coordinate per definire la bounding box di Taranto
              way["highway"]["name"](bbox:40.4,17.1,40.6,17.4);
              way["highway"~"^(footway|pedestrian|cycleway|path)$"]["name"](bbox:40.4,17.1,40.6,17.4);
            );
            out geom meta;
        `;

        try {
            const response = await fetch(this.overpassUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `data=${encodeURIComponent(query)}`
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Alternative query found ${data.elements.length} streets`);

            return this.processStreetData(data.elements);
        } catch (error) {
            console.error('Error with alternative query:', error);
            return [];
        }
    }

    // Nuovo metodo per raccogliere numeri civici
    async fetchHouseNumbers(streetName = null) {
        console.log('Fetching house numbers from OpenStreetMap...');

        let query;
        if (streetName) {
            // Cerca numeri civici per una via specifica
            query = `
                [out:json][timeout:60];
                (
                  node["addr:housenumber"]["addr:street"="${streetName}"](bbox:40.4,17.1,40.6,17.4);
                );
                out meta;
            `;
        } else {
            // Cerca tutti i numeri civici nell'area di Taranto
            query = `
                [out:json][timeout:120];
                (
                  node["addr:housenumber"]["addr:street"](bbox:40.4,17.1,40.6,17.4);
                );
                out meta;
            `;
        }

        try {
            const response = await fetch(this.overpassUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `data=${encodeURIComponent(query)}`
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Found ${data.elements.length} house numbers`);

            return this.processHouseNumbers(data.elements);
        } catch (error) {
            console.error('Error fetching house numbers:', error);
            return [];
        }
    }

    // Processa i numeri civici raccolti
    processHouseNumbers(elements) {
        const houseNumbers = [];

        elements.forEach(element => {
            if (element.tags) {
                const houseNumber = {
                    id: element.id,
                    street: element.tags['addr:street'] || '',
                    houseNumber: element.tags['addr:housenumber'] || '',
                    postcode: element.tags['addr:postcode'] || '',
                    city: element.tags['addr:city'] || '',
                    district: element.tags['addr:suburb'] || element.tags['addr:district'] || '',
                    coordinates: [element.lat, element.lon],
                    tags: element.tags
                };

                // Solo se ha almeno via e numero civico
                if (houseNumber.street && houseNumber.houseNumber) {
                    houseNumbers.push(houseNumber);
                }
            }
        });

        return houseNumbers;
    }

    // Metodo avanzato per raccogliere dati completi delle vie
    async fetchCompleteStreetData() {
        console.log('Starting comprehensive street data collection...');

        try {
            // 1. Raccogli tutte le vie
            console.log('Step 1: Collecting all streets...');
            const streets = await this.fetchTarantoStreets();

            // 2. Raccogli tutti i numeri civici
            console.log('Step 2: Collecting house numbers...');
            const houseNumbers = await this.fetchHouseNumbers();

            // 3. Combina i dati
            console.log('Step 3: Combining data...');
            const completeData = this.combineStreetsAndHouseNumbers(streets, houseNumbers);

            console.log(`Complete data collection finished: ${completeData.length} streets with detailed info`);
            return completeData;

        } catch (error) {
            console.error('Error in complete data collection:', error);
            throw error;
        }
    }

    // Combina vie e numeri civici
    combineStreetsAndHouseNumbers(streets, houseNumbers) {
        const combined = [];

        // Raggruppa numeri civici per via
        const houseNumbersByStreet = {};
        houseNumbers.forEach(hn => {
            if (!houseNumbersByStreet[hn.street]) {
                houseNumbersByStreet[hn.street] = [];
            }
            houseNumbersByStreet[hn.street].push(hn);
        });

        // Per ogni via, aggiungi informazioni sui numeri civici
        streets.forEach(street => {
            const streetHouseNumbers = houseNumbersByStreet[street.name] || [];

            // Calcola range numeri civici
            const numbers = streetHouseNumbers
                .map(hn => parseInt(hn.houseNumber))
                .filter(n => !isNaN(n))
                .sort((a, b) => a - b);

            // Raccogli CAP unici per questa via
            const postcodes = [...new Set(
                streetHouseNumbers
                    .map(hn => hn.postcode)
                    .filter(pc => pc)
            )];

            // Raccogli quartieri menzionati per questa via
            const districts = [...new Set(
                streetHouseNumbers
                    .map(hn => hn.district)
                    .filter(d => d)
            )];

            const completeStreet = {
                ...street,
                houseNumbers: streetHouseNumbers,
                numberRange: {
                    min: numbers.length > 0 ? numbers[0] : null,
                    max: numbers.length > 0 ? numbers[numbers.length - 1] : null,
                    total: numbers.length
                },
                postcodes: postcodes,
                districts: districts,
                hasAddressData: streetHouseNumbers.length > 0
            };

            combined.push(completeStreet);
        });

        // Aggiungi vie che esistono solo nei numeri civici (non nelle strade)
        Object.keys(houseNumbersByStreet).forEach(streetName => {
            const existsInStreets = streets.some(s => s.name === streetName);
            if (!existsInStreets) {
                const streetHouseNumbers = houseNumbersByStreet[streetName];
                const numbers = streetHouseNumbers
                    .map(hn => parseInt(hn.houseNumber))
                    .filter(n => !isNaN(n))
                    .sort((a, b) => a - b);

                // Calcola centroide dalle coordinate dei numeri civici
                const avgLat = streetHouseNumbers.reduce((sum, hn) => sum + hn.coordinates[0], 0) / streetHouseNumbers.length;
                const avgLon = streetHouseNumbers.reduce((sum, hn) => sum + hn.coordinates[1], 0) / streetHouseNumbers.length;

                combined.push({
                    id: `addr_${streetName.replace(/\s+/g, '_')}`,
                    name: streetName,
                    type: 'address-only',
                    coordinates: null,
                    centroid: { lat: avgLat, lon: avgLon },
                    bounds: null,
                    houseNumbers: streetHouseNumbers,
                    numberRange: {
                        min: numbers.length > 0 ? numbers[0] : null,
                        max: numbers.length > 0 ? numbers[numbers.length - 1] : null,
                        total: numbers.length
                    },
                    postcodes: [...new Set(streetHouseNumbers.map(hn => hn.postcode).filter(pc => pc))],
                    districts: [...new Set(streetHouseNumbers.map(hn => hn.district).filter(d => d))],
                    hasAddressData: true,
                    sourceNote: 'Derived from address data only'
                });
            }
        });

        return combined;
    }

    processStreetData(elements) {
        const streets = [];

        elements.forEach(element => {
            if (element.tags && element.tags.name && element.geometry) {
                const street = {
                    id: element.id,
                    name: element.tags.name,
                    type: element.tags.highway,
                    coordinates: element.geometry,
                    centroid: this.calculateCentroid(element.geometry),
                    bounds: this.calculateBounds(element.geometry)
                };
                streets.push(street);
            }
        });

        return streets;
    }

    calculateCentroid(geometry) {
        if (!geometry || geometry.length === 0) return null;

        let lat = 0, lon = 0;
        geometry.forEach(point => {
            lat += point.lat;
            lon += point.lon;
        });

        return {
            lat: lat / geometry.length,
            lon: lon / geometry.length
        };
    }

    calculateBounds(geometry) {
        if (!geometry || geometry.length === 0) return null;

        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

        geometry.forEach(point => {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        });

        return {
            north: maxLat,
            south: minLat,
            east: maxLon,
            west: minLon
        };
    }

    // Query per ottenere i confini amministrativi dei quartieri
    async fetchDistrictBoundaries() {
        console.log('Fetching district boundaries...');

        const query = `
            [out:json][timeout:60];
            (
              relation["admin_level"~"^(9|10)$"]
                     ["name"]
                     (area:3600044749); // Taranto area
              way["admin_level"~"^(9|10)$"]
                 ["name"]
                 (area:3600044749);
            );
            out geom;
        `;

        try {
            const response = await fetch(this.overpassUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `data=${encodeURIComponent(query)}`
            });

            const data = await response.json();
            console.log(`Found ${data.elements.length} administrative boundaries`);

            return this.processDistrictData(data.elements);
        } catch (error) {
            console.error('Error fetching district boundaries:', error);
            return [];
        }
    }

    processDistrictData(elements) {
        const districts = [];

        elements.forEach(element => {
            if (element.tags && element.tags.name) {
                // Process relations (multi-polygon boundaries)
                if (element.type === 'relation' && element.members) {
                    const geometry = this.processRelationGeometry(element);
                    if (geometry) {
                        districts.push({
                            id: element.id,
                            name: element.tags.name,
                            type: 'relation',
                            admin_level: element.tags.admin_level,
                            geometry: geometry
                        });
                    }
                }
                // Process ways (simple polygon boundaries)
                else if (element.type === 'way' && element.geometry) {
                    districts.push({
                        id: element.id,
                        name: element.tags.name,
                        type: 'way',
                        admin_level: element.tags.admin_level,
                        geometry: element.geometry.map(point => [point.lon, point.lat])
                    });
                }
            }
        });

        return districts;
    }

    processRelationGeometry(relation) {
        // Simplified processing - in real implementation would need proper multipolygon handling
        const outerWays = relation.members.filter(m => m.role === 'outer' || m.role === '');
        if (outerWays.length === 0) return null;

        // For now, just take the first outer way as approximation
        const firstOuter = outerWays[0];
        if (firstOuter.geometry) {
            return firstOuter.geometry.map(point => [point.lon, point.lat]);
        }

        return null;
    }

    // Salva i dati in formato JSON
    exportToJSON(streets, districts) {
        const data = {
            metadata: {
                generated: new Date().toISOString(),
                source: 'OpenStreetMap via Overpass API',
                total_streets: streets.length,
                total_districts: districts.length
            },
            streets: streets,
            districts: districts
        };

        return JSON.stringify(data, null, 2);
    }

    // Metodo principale per raccogliere tutti i dati
    async collectAllData() {
        console.log('Starting data collection for Taranto...');

        try {
            const [streets, districts] = await Promise.all([
                this.fetchTarantoStreets(),
                this.fetchDistrictBoundaries()
            ]);

            console.log(`Collected ${streets.length} streets and ${districts.length} districts`);

            return {
                streets,
                districts,
                exportJSON: () => this.exportToJSON(streets, districts)
            };
        } catch (error) {
            console.error('Error in data collection:', error);
            throw error;
        }
    }
}

// Funzione per eseguire la raccolta dati
async function collectTarantoData() {
    const collector = new TarantoDataCollector();

    try {
        const result = await collector.collectAllData();

        // Salva i dati raccolti
        console.log('Data collection completed successfully!');
        console.log('Streets sample:', result.streets.slice(0, 3));
        console.log('Districts sample:', result.districts.slice(0, 3));

        return result;
    } catch (error) {
        console.error('Failed to collect data:', error);
        return null;
    }
}

// Export per l'uso in altri moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TarantoDataCollector, collectTarantoData };
}

// Per l'uso diretto nel browser
if (typeof window !== 'undefined') {
    window.TarantoDataCollector = TarantoDataCollector;
    window.collectTarantoData = collectTarantoData;
}