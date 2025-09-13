// Generatore di confini realistici basato sulle vie reali raccolte
class BoundaryGenerator {
    constructor(streetsData) {
        this.streetsData = streetsData;
        this.generatedBoundaries = null;
    }

    // Genera confini basati su clustering delle vie per quartiere
    generateBoundariesFromStreets() {
        const districtClusters = {};

        // Raggruppa vie per quartiere
        Object.entries(this.streetsData).forEach(([street, data]) => {
            if (!districtClusters[data.district]) {
                districtClusters[data.district] = [];
            }
            districtClusters[data.district].push({
                name: street,
                coordinates: data.coordinates
            });
        });

        const boundaries = {
            type: "FeatureCollection",
            features: []
        };

        // Genera boundary per ogni quartiere
        Object.entries(districtClusters).forEach(([districtName, streets]) => {
            if (streets.length < 2) {
                console.warn(`Quartiere ${districtName} ha solo ${streets.length} vie, saltando`);
                return;
            }

            try {
                const boundary = this.createBoundaryFromPoints(districtName, streets);
                if (boundary) {
                    boundaries.features.push(boundary);
                }
            } catch (error) {
                console.error(`Errore creando boundary per ${districtName}:`, error);
            }
        });

        this.generatedBoundaries = boundaries;
        return boundaries;
    }

    createBoundaryFromPoints(districtName, streets) {
        // Converti coordinate a formato [lon, lat] per turf
        const points = streets.map(street => [street.coordinates[1], street.coordinates[0]]);

        try {
            // Calcola il convex hull dei punti
            const convexHull = turf.convex(turf.featureCollection(
                points.map(point => turf.point(point))
            ));

            if (!convexHull) {
                throw new Error(`Impossibile calcolare convex hull per ${districtName}`);
            }

            // Espandi il poligono di un buffer per includere aree circostanti
            const buffered = turf.buffer(convexHull, 0.5, { units: 'kilometers' });

            // Semplifica il poligono per evitare troppi vertici
            const simplified = turf.simplify(buffered, { tolerance: 0.001 });

            return {
                type: "Feature",
                properties: {
                    name: districtName,
                    description: `Confini generati da ${streets.length} vie`,
                    color: this.getColorForDistrict(districtName),
                    population: this.getPopulationForDistrict(districtName),
                    area_km2: (turf.area(simplified) / 1000000).toFixed(2),
                    generated: true,
                    source: 'street-clustering'
                },
                geometry: simplified.geometry
            };
        } catch (error) {
            console.error(`Errore nel creare boundary per ${districtName}:`, error);
            return null;
        }
    }

    getColorForDistrict(name) {
        const colors = {
            "Città Vecchia": "#e74c3c",
            "Borgo": "#3498db",
            "Tamburi": "#f39c12",
            "Paolo VI": "#9b59b6",
            "Lama": "#27ae60",
            "San Vito": "#e67e22",
            "Salinella": "#34495e",
            "Talsano": "#1abc9c"
        };
        return colors[name] || "#95a5a6";
    }

    getPopulationForDistrict(name) {
        const populations = {
            "Città Vecchia": "Circa 1.500 abitanti",
            "Borgo": "Circa 20.000 abitanti",
            "Tamburi": "Circa 15.000 abitanti",
            "Paolo VI": "Circa 30.000 abitanti",
            "Lama": "Circa 12.000 abitanti",
            "San Vito": "Circa 18.000 abitanti",
            "Salinella": "Circa 8.000 abitanti",
            "Talsano": "Circa 3.500 abitanti"
        };
        return populations[name] || "Popolazione non specificata";
    }

    // Crea confini più accurati usando algoritmo di clustering geografico
    generateClusteredBoundaries() {
        const districtClusters = {};

        // Raggruppa vie per quartiere con informazioni aggiuntive
        Object.entries(this.streetsData).forEach(([street, data]) => {
            if (!districtClusters[data.district]) {
                districtClusters[data.district] = {
                    streets: [],
                    bounds: {
                        north: -Infinity,
                        south: Infinity,
                        east: -Infinity,
                        west: Infinity
                    }
                };
            }

            const cluster = districtClusters[data.district];
            cluster.streets.push({
                name: street,
                coordinates: data.coordinates
            });

            // Aggiorna bounds
            const lat = data.coordinates[0];
            const lon = data.coordinates[1];
            cluster.bounds.north = Math.max(cluster.bounds.north, lat);
            cluster.bounds.south = Math.min(cluster.bounds.south, lat);
            cluster.bounds.east = Math.max(cluster.bounds.east, lon);
            cluster.bounds.west = Math.min(cluster.bounds.west, lon);
        });

        const boundaries = {
            type: "FeatureCollection",
            features: []
        };

        Object.entries(districtClusters).forEach(([districtName, cluster]) => {
            if (cluster.streets.length < 2) return;

            try {
                const boundary = this.createClusteredBoundary(districtName, cluster);
                if (boundary) {
                    boundaries.features.push(boundary);
                }
            } catch (error) {
                console.error(`Errore creando boundary clusterizzato per ${districtName}:`, error);
            }
        });

        return boundaries;
    }

    createClusteredBoundary(districtName, cluster) {
        const points = cluster.streets.map(street =>
            turf.point([street.coordinates[1], street.coordinates[0]])
        );

        try {
            // Usa k-means clustering per identificare le aree principali
            const pointCollection = turf.featureCollection(points);

            // Calcola centroide del cluster
            const centroid = turf.centroid(pointCollection);

            // Calcola distanza media dai punti al centroide
            let avgDistance = 0;
            points.forEach(point => {
                avgDistance += turf.distance(point, centroid, { units: 'kilometers' });
            });
            avgDistance = avgDistance / points.length;

            // Crea un buffer circolare attorno al centroide
            const buffer = turf.buffer(centroid, Math.max(avgDistance * 1.5, 0.8), {
                units: 'kilometers',
                steps: 12 // Poligono più arrotondato
            });

            // Aggiusta il poligono per includere tutti i punti
            const adjustedPolygon = this.adjustPolygonToIncludePoints(buffer, points);

            return {
                type: "Feature",
                properties: {
                    name: districtName,
                    description: `Confini clusterizzati da ${cluster.streets.length} vie`,
                    color: this.getColorForDistrict(districtName),
                    population: this.getPopulationForDistrict(districtName),
                    area_km2: (turf.area(adjustedPolygon) / 1000000).toFixed(2),
                    generated: true,
                    source: 'k-means-clustering',
                    centroid: centroid.geometry.coordinates,
                    avg_distance: avgDistance.toFixed(2)
                },
                geometry: adjustedPolygon.geometry
            };

        } catch (error) {
            console.error(`Errore nel clustering per ${districtName}:`, error);
            return null;
        }
    }

    adjustPolygonToIncludePoints(polygon, points) {
        // Verifica quali punti sono fuori dal poligono e li espande
        const outsidePoints = points.filter(point =>
            !turf.booleanPointInPolygon(point, polygon)
        );

        if (outsidePoints.length === 0) {
            return polygon;
        }

        // Crea un buffer aggiuntivo che include i punti esterni
        const allPoints = turf.featureCollection([
            ...turf.explode(polygon).features,
            ...outsidePoints
        ]);

        const convexHull = turf.convex(allPoints);
        return turf.buffer(convexHull, 0.2, { units: 'kilometers' });
    }

    // Metodo per validare la qualità dei confini generati
    validateGeneratedBoundaries(boundaries) {
        const validationResults = {
            totalDistricts: boundaries.features.length,
            validPolygons: 0,
            averageAccuracy: 0,
            details: []
        };

        let totalAccuracy = 0;

        boundaries.features.forEach(feature => {
            const district = feature.properties.name;
            const districtStreets = Object.entries(this.streetsData)
                .filter(([street, data]) => data.district === district);

            let streetsInBoundary = 0;

            try {
                const polygon = turf.polygon(feature.geometry.coordinates);

                districtStreets.forEach(([street, data]) => {
                    const point = turf.point([data.coordinates[1], data.coordinates[0]]);
                    if (turf.booleanPointInPolygon(point, polygon)) {
                        streetsInBoundary++;
                    }
                });

                const accuracy = districtStreets.length > 0 ?
                    (streetsInBoundary / districtStreets.length) * 100 : 0;

                validationResults.details.push({
                    district: district,
                    accuracy: accuracy,
                    streetsInBoundary: streetsInBoundary,
                    totalStreets: districtStreets.length,
                    area: feature.properties.area_km2
                });

                if (accuracy > 0) validationResults.validPolygons++;
                totalAccuracy += accuracy;

            } catch (error) {
                validationResults.details.push({
                    district: district,
                    error: error.message,
                    accuracy: 0
                });
            }
        });

        validationResults.averageAccuracy = totalAccuracy / boundaries.features.length;
        return validationResults;
    }

    // Esporta i confini generati in formato GeoJSON
    exportBoundaries(boundaries) {
        if (!boundaries) {
            throw new Error('Nessun confine da esportare. Esegui prima generateBoundariesFromStreets()');
        }

        return {
            metadata: {
                generated: new Date().toISOString(),
                method: 'street-clustering',
                total_features: boundaries.features.length,
                generator: 'BoundaryGenerator v1.0'
            },
            data: boundaries
        };
    }
}

// Utility per integrare i nuovi confini nel sistema esistente
class BoundaryIntegrator {
    constructor(originalData, generatedBoundaries) {
        this.originalData = originalData;
        this.generatedBoundaries = generatedBoundaries;
    }

    // Sostituisce i confini originali con quelli generati
    replaceBoundaries() {
        const newData = {
            ...this.originalData,
            features: this.generatedBoundaries.features
        };

        return newData;
    }

    // Unisce i confini mantenendo proprietà originali dove possibile
    mergeBoundaries() {
        const mergedFeatures = this.generatedBoundaries.features.map(newFeature => {
            const originalFeature = this.originalData.features.find(
                f => f.properties.name === newFeature.properties.name
            );

            if (originalFeature) {
                // Mantieni proprietà originali ma usa geometria generata
                return {
                    ...originalFeature,
                    geometry: newFeature.geometry,
                    properties: {
                        ...originalFeature.properties,
                        ...newFeature.properties,
                        // Mantieni colore originale se esiste
                        color: originalFeature.properties.color || newFeature.properties.color
                    }
                };
            }

            return newFeature;
        });

        return {
            ...this.originalData,
            features: mergedFeatures
        };
    }
}

// Export per uso nei moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BoundaryGenerator, BoundaryIntegrator };
}

// Per uso nel browser
if (typeof window !== 'undefined') {
    window.BoundaryGenerator = BoundaryGenerator;
    window.BoundaryIntegrator = BoundaryIntegrator;
}