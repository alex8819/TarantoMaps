// GeoJSON data for Taranto districts
// Coordinates are approximate and should be refined with actual boundary data

const quartieriData = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {
                name: "Città Vecchia",
                description: "Il centro storico di Taranto, circondato dal mare",
                color: "#e74c3c",
                population: "Circa 2.500 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.2330, 40.4738],
                    [17.2380, 40.4738],
                    [17.2380, 40.4705],
                    [17.2330, 40.4705],
                    [17.2330, 40.4738]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Borgo",
                description: "Il quartiere commerciale e amministrativo",
                color: "#3498db",
                population: "Circa 15.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.2280, 40.4780],
                    [17.2420, 40.4780],
                    [17.2420, 40.4740],
                    [17.2280, 40.4740],
                    [17.2280, 40.4780]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Tamburi",
                description: "Quartiere industriale vicino all'ILVA",
                color: "#f39c12",
                population: "Circa 15.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.2100, 40.4900],
                    [17.2300, 40.4900],
                    [17.2300, 40.4780],
                    [17.2100, 40.4780],
                    [17.2100, 40.4900]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Paolo VI",
                description: "Quartiere residenziale moderno",
                color: "#9b59b6",
                population: "Circa 25.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.2420, 40.4900],
                    [17.2650, 40.4900],
                    [17.2650, 40.4750],
                    [17.2420, 40.4750],
                    [17.2420, 40.4900]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Lama",
                description: "Quartiere periferico est",
                color: "#27ae60",
                population: "Circa 8.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.2650, 40.4850],
                    [17.2850, 40.4850],
                    [17.2850, 40.4700],
                    [17.2650, 40.4700],
                    [17.2650, 40.4850]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "San Vito",
                description: "Quartiere residenziale ovest",
                color: "#e67e22",
                population: "Circa 12.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.1900, 40.4800],
                    [17.2150, 40.4800],
                    [17.2150, 40.4650],
                    [17.1900, 40.4650],
                    [17.1900, 40.4800]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Talsano",
                description: "Frazione a sud di Taranto",
                color: "#1abc9c",
                population: "Circa 3.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.2300, 40.4500],
                    [17.2600, 40.4500],
                    [17.2600, 40.4350],
                    [17.2300, 40.4350],
                    [17.2300, 40.4500]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Salinella",
                description: "Quartiere sud-est",
                color: "#34495e",
                population: "Circa 5.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.2500, 40.4650],
                    [17.2750, 40.4650],
                    [17.2750, 40.4550],
                    [17.2500, 40.4550],
                    [17.2500, 40.4650]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Statte",
                description: "Comune della provincia di Taranto",
                color: "#8e44ad",
                population: "Circa 14.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.1600, 40.5200],
                    [17.2000, 40.5200],
                    [17.2000, 40.5000],
                    [17.1600, 40.5000],
                    [17.1600, 40.5200]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Massafra",
                description: "Comune della provincia di Taranto",
                color: "#16a085",
                population: "Circa 32.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.1200, 40.6200],
                    [17.1700, 40.6200],
                    [17.1700, 40.5800],
                    [17.1200, 40.5800],
                    [17.1200, 40.6200]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Crispiano",
                description: "Comune della provincia di Taranto",
                color: "#d35400",
                population: "Circa 13.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.3500, 40.5800],
                    [17.4000, 40.5800],
                    [17.4000, 40.5400],
                    [17.3500, 40.5400],
                    [17.3500, 40.5800]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Leporano",
                description: "Comune costiero della provincia",
                color: "#2980b9",
                population: "Circa 8.000 abitanti"
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [17.3000, 40.3800],
                    [17.3500, 40.3800],
                    [17.3500, 40.3400],
                    [17.3000, 40.3400],
                    [17.3000, 40.3800]
                ]]
            }
        }
    ]
};

// Sample street data for demonstration
// In a real implementation, this would be much more comprehensive
const streetsData = {
    "Via Dante": { district: "Borgo", coordinates: [17.2350, 40.4760] },
    "Corso Umberto": { district: "Borgo", coordinates: [17.2380, 40.4765] },
    "Via Garibaldi": { district: "Città Vecchia", coordinates: [17.2355, 40.4720] },
    "Via Pitagora": { district: "Paolo VI", coordinates: [17.2550, 40.4850] },
    "Via Aristotele": { district: "Paolo VI", coordinates: [17.2580, 40.4820] },
    "Via Archita": { district: "Tamburi", coordinates: [17.2200, 40.4850] },
    "Via Leonida": { district: "Tamburi", coordinates: [17.2180, 40.4820] },
    "Via Platone": { district: "Lama", coordinates: [17.2750, 40.4800] },
    "Via San Francesco": { district: "Città Vecchia", coordinates: [17.2340, 40.4715] },
    "Viale Virgilio": { district: "San Vito", coordinates: [17.2000, 40.4750] },
    "Via Kennedy": { district: "Paolo VI", coordinates: [17.2500, 40.4880] },
    "Via Magna Grecia": { district: "Borgo", coordinates: [17.2400, 40.4770] },
    "Via Cesare Battisti": { district: "Borgo", coordinates: [17.2320, 40.4755] },
    "Via Mazzini": { district: "Borgo", coordinates: [17.2365, 40.4758] }
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { quartieriData, streetsData };
}