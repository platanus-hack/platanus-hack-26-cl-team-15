// What the inspector has chosen: the season, the parcel open, the stops for the route.
// Kept in this browser only; a reload keeps the choice, nothing leaves the page.
const KEY = 'caudal.state.v1';
const DEFAULT = { season: '2024-25', current: null, route: null, start: null, startTime: '08:30' };

function read() {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT }; }
}
let state = read();

export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* the choice is not remembered */ }
  document.dispatchEvent(new CustomEvent('caudal:state'));
  return state;
}
export function toggleStop(id) {
  const route = state.route || [];
  return setState({ route: route.includes(id) ? route.filter((r) => r !== id) : [...route, id] });
}
