const { parse } = require('cookie');
const { db } = require('../db/database');
const { SESSION_COOKIE_NAME } = require('../config/config');

// In-memory presence map: checklistId -> Map(socketId -> username)
const checklistViewers = new Map();

function setupSocketHandler(io) {
  // Socket.io authentication middleware (allows both authenticated users and public guest viewers)
  io.use((socket, next) => {
    const rawCookies = socket.handshake.headers.cookie;
    if (!rawCookies) {
      socket.user = null;
      socket.isGuest = true;
      return next();
    }

    try {
      const cookies = parse(rawCookies);
      const token = cookies[SESSION_COOKIE_NAME];
      if (!token) {
        socket.user = null;
        socket.isGuest = true;
        return next();
      }

      const session = db.sessions.get(token);
      if (!session) {
        socket.user = null;
        socket.isGuest = true;
        return next();
      }

      const user = db.users.findById(session.user_id);
      if (!user || user.status !== 'ACTIVE') {
        socket.user = null;
        socket.isGuest = true;
        return next();
      }

      const allRoles = db.roles.findAll();
      const userRoles = allRoles.filter(r => (user.role_ids || []).includes(r.id));
      const isAdmin = userRoles.some(r => r.is_admin);

      socket.user = {
        id: user.id,
        username: user.username,
        roles: userRoles,
        isAdmin
      };
      socket.isGuest = false;

      next();
    } catch (err) {
      socket.user = null;
      socket.isGuest = true;
      return next();
    }
  });

  io.on('connection', (socket) => {
    const username = socket.user ? socket.user.username : null;
    let currentChecklistRoom = null;

    // Join checklist room and track active viewer presence
    socket.on('join_checklist', ({ checklistId }) => {
      if (!checklistId) return;

      // Leave prior room if any
      if (currentChecklistRoom && currentChecklistRoom !== `checklist_${checklistId}`) {
        socket.leave(currentChecklistRoom);
        removeViewer(currentChecklistRoom, socket.id, io);
      }

      const roomName = `checklist_${checklistId}`;
      currentChecklistRoom = roomName;
      socket.join(roomName);

      if (username) {
        if (!checklistViewers.has(roomName)) {
          checklistViewers.set(roomName, new Map());
        }
        checklistViewers.get(roomName).set(socket.id, username);
        broadcastViewers(roomName, io);
      }
    });

    // Leave checklist room
    socket.on('leave_checklist', ({ checklistId }) => {
      const roomName = `checklist_${checklistId}`;
      socket.leave(roomName);
      removeViewer(roomName, socket.id, io);
      if (currentChecklistRoom === roomName) {
        currentChecklistRoom = null;
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      if (currentChecklistRoom) {
        removeViewer(currentChecklistRoom, socket.id, io);
      }
    });
  });

  function removeViewer(roomName, socketId, ioInstance) {
    if (checklistViewers.has(roomName)) {
      const viewers = checklistViewers.get(roomName);
      viewers.delete(socketId);
      if (viewers.size === 0) {
        checklistViewers.delete(roomName);
      }
      broadcastViewers(roomName, ioInstance);
    }
  }

  function broadcastViewers(roomName, ioInstance) {
    const viewersMap = checklistViewers.get(roomName);
    const uniqueUsers = viewersMap ? Array.from(new Set(viewersMap.values())) : [];
    ioInstance.to(roomName).emit('checklist_viewers', {
      room: roomName,
      viewers: uniqueUsers
    });
  }
}

module.exports = {
  setupSocketHandler
};
