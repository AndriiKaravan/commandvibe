/** Source of randomness for picks and the roulette; replaced by a fixed one in tests. */
export const RANDOM = Symbol('RANDOM');

/** Where the game publishes its events (realtime in production, a recorder in tests). */
export const GAME_EVENTS = Symbol('GAME_EVENTS');
