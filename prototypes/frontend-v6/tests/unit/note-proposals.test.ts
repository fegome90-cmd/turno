// Contrato de propuestas de nota (R5b): solo se acepta la forma exacta de R5a.
import {describe, expect, it} from 'vitest';
import {parseNoteProposalResponse} from '../../src/adapters/note-proposals';

const suggestion = (overrides: Record<string, unknown> = {}) => ({
  id: 'note:note-1:2', kind: 'note-task', title: 'Solicitar etiquetas de despacho',
  sourceQuote: 'Solicitar etiquetas de despacho antes de las 18:00', noteId: 'note-1', noteVersion: 2,
  channel: 'inline', actions: ['review', 'dismiss'], requiresApproval: true, ...overrides,
});
const response = (overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) => ({
  status: 'proposed', noteId: 'note-1', noteVersion: 2, suggestions: [suggestion(item)], ...overrides,
});

describe('parseNoteProposalResponse', () => {
  it('acepta exactamente la forma de R5a y devuelve la propuesta', () => {
    expect(parseNoteProposalResponse(response())).toEqual({
      id: 'note:note-1:2', kind: 'note-task', title: 'Solicitar etiquetas de despacho',
      sourceQuote: 'Solicitar etiquetas de despacho antes de las 18:00', noteId: 'note-1', noteVersion: 2,
    });
  });

  it('rechaza abstenciones, versiones obsoletas y respuestas sin forma', () => {
    expect(parseNoteProposalResponse({status: 'abstain', reason: 'no_proposal', suggestions: []})).toBeNull();
    expect(parseNoteProposalResponse({status: 'stale', reason: 'stale_version', suggestions: []})).toBeNull();
    expect(parseNoteProposalResponse(null)).toBeNull();
    expect(parseNoteProposalResponse('proposed')).toBeNull();
    expect(parseNoteProposalResponse({status: 'proposed', noteId: 'note-1', noteVersion: 2})).toBeNull();
  });

  it('exige exactamente una sugerencia', () => {
    expect(parseNoteProposalResponse({...response(), suggestions: []})).toBeNull();
    expect(parseNoteProposalResponse({...response(), suggestions: [suggestion(), suggestion({id: 'note:note-1:2:b'})]})).toBeNull();
  });

  it('rechaza un tipo distinto, una propuesta sin aprobación o una acción extra', () => {
    expect(parseNoteProposalResponse(response({}, {kind: 'reminder'}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {requiresApproval: false}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {actions: ['review', 'dismiss', 'save']}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {actions: ['dismiss', 'review']}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {channel: 'tray'}))).toBeNull();
  });

  it('rechaza títulos vacíos o de más de 80 caracteres', () => {
    expect(parseNoteProposalResponse(response({}, {title: ''}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {title: '   '}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {title: 'a'.repeat(81)}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {title: 'a'.repeat(80)}))?.title).toHaveLength(80);
  });

  it('rechaza una propuesta que no corresponde a la nota y versión de la respuesta', () => {
    expect(parseNoteProposalResponse(response({}, {noteId: 'note-2'}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {noteVersion: 3}))).toBeNull();
    expect(parseNoteProposalResponse(response({}, {id: 'note:note-1:3'}))).toBeNull();
  });
});
