// Server-owned pilot fixtures. No database, browser payload or real clinical data.
const shift = {
  shiftId: 'demo-shift', synthetic: true,
  beds: [{ id: 'bed-1', label: 'Cama 1' }, { id: 'bed-2', label: 'Cama 2' }],
  drafts: [
    { id: 'a', title: 'Revisar material sintético', bedLabel: 'Cama 4', bedId: null, time: '15:00', date: null },
    { id: 'b', title: 'Preparar informe sintético', beforeClose: true, completed: false },
  ],
  noteText: 'Hay que revisar el material sintético antes del cierre.',
};

/** Replace this backend-owned interface later, never with a browser snapshot. */
export function getAuthorizedSnapshot(event) {
  if (event?.synthetic !== true || event.shiftId !== shift.shiftId) return null;
  return structuredClone(shift);
}
