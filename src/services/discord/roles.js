// Servicio para gestión de roles de Discord

import { TOURNAMENT_COLORS } from '../../utils/constants.js';

export class RoleService {
  // Crear rol de participante del torneo
  static async createParticipantRole(guild, tournamentName) {
    const role = await guild.roles.create({
      name: `${tournamentName} Participant`,
      color: TOURNAMENT_COLORS.primary,
      hoist: true,
      mentionable: true
    });

    return role;
  }

  // Asignar rol de participante a miembros del equipo
  static async assignParticipantRole(guild, memberIds, roleId) {
    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    const results = [];
    for (const memberId of memberIds) {
      try {
        const member = await guild.members.fetch(memberId);
        await member.roles.add(role);
        results.push({ memberId, success: true });
      } catch (error) {
        console.error(`Error asignando rol a ${memberId}:`, error);
        results.push({ memberId, success: false, error });
      }
    }

    return results;
  }

  // Asignar rol específico del equipo
  static async assignTeamRole(guild, memberIds, roleId) {
    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    const results = [];
    for (const memberId of memberIds) {
      try {
        const member = await guild.members.fetch(memberId);
        await member.roles.add(role);
        results.push({ memberId, success: true });
      } catch (error) {
        console.error(`Error asignando rol de equipo a ${memberId}:`, error);
        results.push({ memberId, success: false, error });
      }
    }

    return results;
  }

  // Remover rol de participante
  static async removeParticipantRole(guild, memberIds, roleId) {
    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    const results = [];
    for (const memberId of memberIds) {
      try {
        const member = await guild.members.fetch(memberId);
        await member.roles.remove(role);
        results.push({ memberId, success: true });
      } catch (error) {
        console.error(`Error removiendo rol de ${memberId}:`, error);
        results.push({ memberId, success: false, error });
      }
    }

    return results;
  }

  // Eliminar rol del torneo
  static async deleteTournamentRole(guild, roleId) {
    try {
      let deletedCount = 0;
      
      // Eliminar solo el rol específico del torneo si se proporciona roleId
      if (roleId) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          console.log(`🗑️ Eliminando rol del torneo por ID: ${role.name}`);
          await role.delete();
          deletedCount++;
          console.log(`✅ Rol del torneo eliminado: ${role.name}`);
        }
      }
      
      // TAMBIÉN eliminar roles que contengan exactamente estos patrones específicos del bot
      const safePatternsToDelete = [
        'Participant'      // Rol de participante del torneo (ej: "hola Participant", "Tournament Participant")
      ];
      
      const rolesToDelete = guild.roles.cache.filter(role => {
        // Solo eliminar si el rol contiene EXACTAMENTE estos términos Y no es un rol del sistema
        return !role.managed && // No eliminar roles de bots/integraciones
               !role.tags &&    // No eliminar roles especiales
               role.name !== '@everyone' && // Nunca tocar @everyone
               role.id !== roleId && // No duplicar eliminación del rol por ID
               safePatternsToDelete.some(pattern => 
                 role.name.includes(pattern)
               );
      });
      
      for (const [, role] of rolesToDelete) {
        try {
          console.log(`🗑️ Eliminando rol por patrón: ${role.name}`);
          await role.delete();
          deletedCount++;
          console.log(`✅ Rol eliminado: ${role.name}`);
          await new Promise(resolve => setTimeout(resolve, 300)); // Evitar rate limit
        } catch (error) {
          console.error(`❌ Error eliminando rol ${role.name}:`, error.message);
        }
      }
      
      console.log(`✅ Total de roles eliminados: ${deletedCount}`);
      
    } catch (error) {
      console.error('Error eliminando rol del torneo:', error);
    }
  }

  // Crear roles específicos por equipo
  static async createTeamRole(guild, teamName, tournamentName) {
    // Colores variados para diferentes equipos
    const teamColors = [
      0xFF6B6B, // Rojo
      0x4ECDC4, // Cyan
      0xFFE66D, // Amarillo
      0x95E1D3, // Verde agua
      0xF38181, // Rosa
      0xAA96DA, // Morado
      0xFCBF49, // Naranja
      0x06FFA5, // Verde neón
      0x5DADE2, // Azul
      0xF8B500  // Dorado
    ];
    
    // Seleccionar color basado en el hash del nombre del equipo
    const colorIndex = teamName.length % teamColors.length;
    
    const role = await guild.roles.create({
      name: teamName,
      color: teamColors[colorIndex],
      hoist: true, // Mostrar miembros separados en la lista
      mentionable: true
    });

    return role;
  }
}