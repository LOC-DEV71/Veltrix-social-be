module.exports = {
  checkPermission: (channel, memberId, memberRole, permissionId) => {
    // Owners and admins bypass permission checks
    if (memberRole === 'owner' || memberRole === 'admin') return true;

    if (!channel || !channel.permissionOverwrites) return true; // Default is true if no overrides

    let isAllowed = true; // Default behavior
    
    // Administrative Permissions (Default: false)
    if (['manage_channel', 'manage_permissions', 'manage_webhooks', 'manage_messages', 'manage_threads'].includes(permissionId)) {
      isAllowed = false;
    }
    
    // General Permissions (Default: true)
    if (['view_channel', 'create_invite', 'send_messages', 'send_messages_in_threads', 'create_public_threads', 'create_private_threads', 'embed_links', 'attach_files', 'add_reactions', 'use_external_emojis', 'use_external_stickers', 'mention_everyone', 'read_message_history', 'send_tts_messages', 'send_voice_messages', 'create_polls', 'use_application_commands', 'use_activities', 'use_external_apps'].includes(permissionId)) {
      isAllowed = true;
    }

    // Evaluate in order of precedence: @everyone -> role -> member
    
    // 1. @everyone
    const everyoneOverwrite = channel.permissionOverwrites.find(o => o.id === 'everyone');
    if (everyoneOverwrite) {
      if (everyoneOverwrite.deny && everyoneOverwrite.deny.includes(permissionId)) isAllowed = false;
      if (everyoneOverwrite.allow && everyoneOverwrite.allow.includes(permissionId)) isAllowed = true;
    }

    // 2. Role (e.g., 'member')
    const roleOverwrite = channel.permissionOverwrites.find(o => o.id === memberRole);
    if (roleOverwrite) {
      if (roleOverwrite.deny && roleOverwrite.deny.includes(permissionId)) isAllowed = false;
      if (roleOverwrite.allow && roleOverwrite.allow.includes(permissionId)) isAllowed = true;
    }

    // 3. Member specifically
    const memberOverwrite = channel.permissionOverwrites.find(o => o.id === memberId.toString());
    if (memberOverwrite) {
      if (memberOverwrite.deny && memberOverwrite.deny.includes(permissionId)) isAllowed = false;
      if (memberOverwrite.allow && memberOverwrite.allow.includes(permissionId)) isAllowed = true;
    }

    return isAllowed;
  }
};
