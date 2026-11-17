/** Ephemeral navigation handoff: no query in URLs, history.state or browser storage. */
let pending = '';
const listeners = new Set<(query: string) => void>();
export function setSearchDraft(query: string) {
  pending = query;
  if (listeners.size) {
    listeners.forEach((receive) => receive(query));
    pending = '';
  }
}
export function takeSearchDraft() {
  const value = pending;
  pending = '';
  return value;
}
export function clearSearchDraft() {
  pending = '';
}
export function subscribeSearchDraft(receive: (query: string) => void) {
  listeners.add(receive);
  return () => {
    listeners.delete(receive);
  };
}
