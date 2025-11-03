import { google } from 'googleapis';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Servicio para manejar la integración con Google Sheets
 */
export class GoogleSheetsService {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        this.initialized = false;
    }

    /**
     * Inicializa la conexión con Google Sheets
     */
    async initialize() {
        try {
            // Establecer spreadsheetId aquí por si acaso no estaba disponible en el constructor
            this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
            
            if (!this.spreadsheetId) {
                console.log('❌ GOOGLE_SHEETS_ID no está configurado en variables de entorno');
                return false;
            }
            
            // Configurar autenticación usando service account
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    type: "service_account",
                    project_id: process.env.GOOGLE_PROJECT_ID || "easybot-customs",
                    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            
            // Verificar que el spreadsheet existe y crear las hojas necesarias
            await this.setupSheets();
            
            this.initialized = true;
            console.log('✅ Google Sheets conectado exitosamente');
            return true;
        } catch (error) {
            console.error('❌ Error al conectar con Google Sheets:', error.message);
            return false;
        }
    }

    /**
     * Configura las hojas necesarias en el spreadsheet
     */
    async setupSheets() {
        if (!this.sheets || !this.spreadsheetId) return;

        try {
            // Obtener información del spreadsheet
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });

            const existingSheets = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
            const requiredSheets = ['Registros', 'Resultados', 'Leaderboard', 'Configuracion'];

            // Crear hojas que no existen
            for (const sheetName of requiredSheets) {
                if (!existingSheets.includes(sheetName)) {
                    await this.createSheet(sheetName);
                }
            }

            // Configurar headers si es necesario
            await this.setupHeaders();

        } catch (error) {
            console.error('Error al configurar hojas:', error.message);
        }
    }

    /**
     * Crea una nueva hoja en el spreadsheet
     */
    async createSheet(title) {
        try {
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: title,
                                gridProperties: {
                                    rowCount: 1000,
                                    columnCount: 20
                                }
                            }
                        }
                    }]
                }
            });
            console.log(`📊 Hoja "${title}" creada exitosamente`);
        } catch (error) {
            console.error(`Error al crear hoja ${title}:`, error.message);
        }
    }

    /**
     * Configura los headers de las hojas
     */
    async setupHeaders() {
        const headers = {
            'Registros': [
                'Fecha/Hora', 'Nombre del Equipo', 'Capitán', 'Jugadores', 
                'Discord del Capitán', 'User ID', 'Tournament ID'
            ],
            'Resultados': [
                'Fecha/Hora', 'Nombre del Equipo', 'Posición', 'Total Kills', 
                'Multiplicador', 'Puntuación Final', 'Tournament ID', 'Enviado por', 'User ID'
            ],
            'Leaderboard': [
                'Posición', 'Nombre del Equipo', 'Puntos Totales', 'Total Kills', 
                'Partidas Jugadas', 'Mejor Posición', 'Promedio Puntos'
            ],
            'Configuracion': [
                'Parámetro', 'Valor', 'Descripción', 'Última actualización'
            ]
        };

        for (const [sheetName, headerRow] of Object.entries(headers)) {
            try {
                // Verificar si ya tiene headers
                const range = `${sheetName}!A1:Z1`;
                const response = await this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.spreadsheetId,
                    range: range,
                });

                // Si no hay datos en la primera fila, agregar headers
                if (!response.data.values || response.data.values.length === 0) {
                    await this.sheets.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range: `${sheetName}!A1`,
                        valueInputOption: 'RAW',
                        resource: {
                            values: [headerRow]
                        }
                    });
                }
            } catch (error) {
                console.error(`Error al configurar headers para ${sheetName}:`, error.message);
            }
        }
    }

    /**
     * Registra un nuevo equipo en Google Sheets
     */
    async registerTeam(teamData, tournamentId) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const row = [
                new Date().toLocaleString('es-ES'),
                teamData.name,
                teamData.captain || 'Pendiente',
                Array.isArray(teamData.players) ? teamData.players.join(', ') : '',
                teamData.captainDiscord || 'Pendiente',
                teamData.userId || '',
                tournamentId || 'default'
            ];

            console.log(`📊 Intentando registrar equipo en Google Sheets:`, row);

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Registros!A:G',
                valueInputOption: 'RAW',
                resource: {
                    values: [row]
                }
            });

            console.log(`✅ Equipo "${teamData.name}" registrado exitosamente en Google Sheets`);
            
            // Inicializar en el Leaderboard
            await this.initializeTeamInLeaderboard(teamData.name, tournamentId);
            
            return true;
        } catch (error) {
            console.error('❌ Error al registrar equipo en Google Sheets:', error);
            console.error('Detalles del error:', error.message);
            return false;
        }
    }

    /**
     * Actualiza los miembros de un equipo en Google Sheets
     */
    async updateTeamMembers(teamName, members, captain, tournamentId) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // Buscar el equipo en la hoja de Registros
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Registros!A:G'
            });

            const rows = response.data.values || [];
            
            // Encontrar la fila del equipo (columna B es el nombre del equipo)
            const rowIndex = rows.findIndex(row => row[1] === teamName);
            
            if (rowIndex >= 0) {
                // Actualizar la fila existente
                const row = [
                    rows[rowIndex][0] || new Date().toLocaleString('es-ES'), // Mantener fecha original
                    teamName,
                    captain,
                    members.join(', '),
                    captain, // Captain Discord (mismo que captain por ahora)
                    rows[rowIndex][5] || '', // Mantener userId original
                    tournamentId || 'default'
                ];

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `Registros!A${rowIndex + 1}:G${rowIndex + 1}`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [row]
                    }
                });

                console.log(`📊 Equipo "${teamName}" actualizado en Google Sheets`);
            } else {
                // Si no existe, crear nuevo registro
                const row = [
                    new Date().toLocaleString('es-ES'),
                    teamName,
                    captain,
                    members.join(', '),
                    captain,
                    '',
                    tournamentId || 'default'
                ];

                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Registros!A:G',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [row]
                    }
                });

                console.log(`📊 Equipo "${teamName}" creado en Google Sheets`);
            }
            
            return true;
        } catch (error) {
            console.error('Error al actualizar equipo en Google Sheets:', error.message);
            return false;
        }
    }

    /**
     * Inicializa un equipo en el Leaderboard con puntuación 0
     */
    async initializeTeamInLeaderboard(teamName, tournamentId = null) {
        try {
            // Obtener equipos actuales en el leaderboard
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Leaderboard!A2:G'
            });

            const currentTeams = response.data.values || [];
            const teamExists = currentTeams.some(row => row[1] === teamName);

            // Si el equipo ya existe, no hacer nada
            if (teamExists) {
                return true;
            }

            // Agregar nuevo equipo al final con estadísticas en 0
            const newPosition = currentTeams.length + 1;
            const row = [
                newPosition,  // Posición temporal
                teamName,     // Nombre del equipo
                0,            // Puntos totales
                0,            // Total kills
                0,            // Partidas jugadas
                15,           // Mejor posición (por defecto la peor)
                0             // Promedio de puntos
            ];

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Leaderboard!A:G',
                valueInputOption: 'RAW',
                resource: {
                    values: [row]
                }
            });

            console.log(`📊 Equipo "${teamName}" inicializado en Leaderboard`);
            return true;
        } catch (error) {
            console.error('Error al inicializar equipo en leaderboard:', error.message);
            return false;
        }
    }

    /**
     * Registra un resultado en Google Sheets
     */
    async submitResult(resultData, tournamentId) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const row = [
                new Date().toLocaleString('es-ES'),
                resultData.teamName,
                resultData.position,
                resultData.totalKills || 0,
                resultData.multiplier || 1.0,
                resultData.finalScore || 0,
                tournamentId || 'default',
                resultData.submittedBy,
                resultData.userId
            ];

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Resultados!A:I',
                valueInputOption: 'RAW',
                resource: {
                    values: [row]
                }
            });

            console.log(`📊 Resultado para "${resultData.teamName}" guardado en Google Sheets`);
            
            // Actualizar leaderboard automáticamente
            await this.updateLeaderboard(tournamentId);
            
            return true;
        } catch (error) {
            console.error('Error al guardar resultado en Google Sheets:', error.message);
            return false;
        }
    }

    /**
     * Obtiene todos los registros de equipos
     */
    async getTeamRegistrations(tournamentId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Registros!A2:G', // Saltar header
            });

            let teams = response.data.values || [];
            
            // Filtrar por tournament ID si se especifica
            if (tournamentId) {
                teams = teams.filter(row => row[6] === tournamentId);
            }

            return teams.map(row => ({
                date: row[0],
                name: row[1],
                captain: row[2],
                players: row[3]?.split(', ') || [],
                captainDiscord: row[4],
                userId: row[5],
                tournamentId: row[6]
            }));
        } catch (error) {
            console.error('Error al obtener registros:', error.message);
            return [];
        }
    }

    /**
     * Obtiene todos los resultados
     */
    async getResults(tournamentId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Resultados!A2:I', // Saltar header, incluir todas las columnas
            });

            let results = response.data.values || [];
            
            // Filtrar por tournament ID si se especifica
            if (tournamentId) {
                results = results.filter(row => row[6] === tournamentId);
            }

            return results.map(row => ({
                date: row[0],
                teamName: row[1],
                position: parseInt(row[2]) || 0,
                totalKills: parseInt(row[3]) || 0,
                multiplier: parseFloat(row[4]) || 1.0,
                finalScore: parseInt(row[5]) || 0,
                tournamentId: row[6],
                submittedBy: row[7],
                userId: row[8]
            }));
        } catch (error) {
            console.error('Error al obtener resultados:', error.message);
            return [];
        }
    }

    /**
     * Actualiza el Leaderboard con las puntuaciones ordenadas
     */
    async updateLeaderboard(tournamentId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // Obtener todos los resultados
            const results = await this.getResults(tournamentId);
            
            // Calcular estadísticas por equipo
            const teamStats = {};
            
            for (const result of results) {
                const teamName = result.teamName;
                
                if (!teamStats[teamName]) {
                    teamStats[teamName] = {
                        totalScore: 0,
                        totalKills: 0,
                        gamesPlayed: 0,
                        bestPosition: 15
                    };
                }
                
                teamStats[teamName].totalScore += result.finalScore || 0;
                teamStats[teamName].totalKills += result.totalKills || 0;
                teamStats[teamName].gamesPlayed += 1;
                
                if (result.position < teamStats[teamName].bestPosition) {
                    teamStats[teamName].bestPosition = result.position;
                }
            }
            
            // Convertir a array y ordenar por puntuación total (descendente)
            const leaderboardData = Object.entries(teamStats)
                .map(([teamName, stats]) => ({
                    teamName,
                    totalScore: stats.totalScore,
                    totalKills: stats.totalKills,
                    gamesPlayed: stats.gamesPlayed,
                    bestPosition: stats.bestPosition,
                    avgScore: stats.gamesPlayed > 0 ? (stats.totalScore / stats.gamesPlayed).toFixed(2) : 0
                }))
                .sort((a, b) => b.totalScore - a.totalScore);
            
            // Preparar filas para Google Sheets
            const rows = leaderboardData.map((team, index) => [
                index + 1, // Posición
                team.teamName,
                team.totalScore,
                team.totalKills,
                team.gamesPlayed,
                team.bestPosition,
                team.avgScore
            ]);
            
            // Limpiar hoja de Leaderboard (excepto headers)
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'Leaderboard!A2:G'
            });
            
            // Escribir nuevos datos
            if (rows.length > 0) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Leaderboard!A2',
                    valueInputOption: 'RAW',
                    resource: {
                        values: rows
                    }
                });
            }
            
            console.log(`📊 Leaderboard actualizado con ${rows.length} equipos`);
            return true;
        } catch (error) {
            console.error('Error al actualizar leaderboard:', error.message);
            return false;
        }
    }

    /**
     * Limpia todas las hojas del torneo (excepto headers)
     */
    async clearAllTournamentData(tournamentId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const sheets = ['Registros', 'Resultados', 'Leaderboard'];
            let clearedSheets = 0;

            for (const sheetName of sheets) {
                try {
                    // Limpiar todo excepto la fila de headers (A2 en adelante)
                    await this.sheets.spreadsheets.values.clear({
                        spreadsheetId: this.spreadsheetId,
                        range: `${sheetName}!A2:Z`
                    });
                    
                    console.log(`🧹 Hoja "${sheetName}" limpiada`);
                    clearedSheets++;
                } catch (error) {
                    console.error(`Error limpiando hoja ${sheetName}:`, error.message);
                }
            }

            console.log(`✅ ${clearedSheets} hojas limpiadas exitosamente`);
            return true;
        } catch (error) {
            console.error('Error al limpiar hojas del torneo:', error.message);
            return false;
        }
    }

    /**
     * Verifica el estado de la conexión
     */
    async checkConnection() {
        if (!this.spreadsheetId) {
            return { connected: false, error: 'GOOGLE_SHEETS_ID no configurado' };
        }

        try {
            await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });
            return { connected: true, error: null };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }
}

// Singleton instance
export const googleSheetsService = new GoogleSheetsService();