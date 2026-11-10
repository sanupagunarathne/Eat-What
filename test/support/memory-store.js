// Test double only: production always uses PostgreSQL.
export function memoryStore() {
  const rooms = new Map();
  return {
    async create(room) {
      if (rooms.has(room.code)) return false;
      rooms.set(room.code, structuredClone(room));
      return true;
    },
    async get(code) {
      return structuredClone(rooms.get(code));
    },
    async update(code, mutate) {
      const room = structuredClone(rooms.get(code));
      const response = mutate(room);
      rooms.set(code, room);
      return response;
    },
  };
}
