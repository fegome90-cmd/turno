// Tipos compartidos del dominio (PLAN §4). Nombres y representación de v5; sin React ni APIs de host.
export type Priority = 'low' | 'normal' | 'high';
export type ShiftStatus = 'open' | 'closed';
export type Shift = {id: string; label: string; date: string; status: ShiftStatus};
// `Bed` es el concepto interno de «lista» (D7): el texto visible es «Lista»; los nombres internos no cambian.
export type Bed = {id: string; shiftId: string; label: string};
export type Task = {
  id: string;
  shiftId: string;
  bedId: string | null;
  title: string;
  body: string;
  reason: string;
  priority: Priority;
  date: string | null;
  time: string;
  estimate: string;
  performed: string;
  duration: string;
  completed: boolean;
  beforeClose?: boolean;
  version: number;
};
export type ReviewedTaskInput = {shiftId: string; title: string; bedId: string | null; date: string | null; time: string; beforeClose: boolean};
export type QuickNote = {id: string; title: string; body: string; version: number};
export type Snapshot = {
  profile: {preferredName: string};
  activeShiftId: string | null;
  shifts: Shift[];
  beds: Bed[];
  tasks: Task[];
  notes: QuickNote[];
};
export type TemporalDraft = {date: string; time: string; estimate: string; performed: string; duration: string};
export type FieldErrors = Partial<Record<'title' | 'body' | keyof TemporalDraft, string>>;
export type Selection = {kind: 'task' | 'note'; id: string} | null;
export type Route = {view: 'home' | 'workspace' | 'notes' | 'archive'; selected: Selection; archiveId: string | null};
export type AgendaGroup = {date: string | null; label: string; tasks: Task[]};
