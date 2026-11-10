import subprocess,sys,json,os,re
ROOT=os.environ['M']
PATH_=os.environ['PATH']
muts=[
('N1 parseTime acepta 24:00','src/domain/validation.ts',"/^([01]\\d|2[0-3]):[0-5]\\d$/","/^([01]\\d|2[0-4]):[0-5]\\d$/"),
('N1b adaptador acepta 24:00','src/adapters/preview-adapter.ts',"/^([01]\\d|2[0-3]):[0-5]\\d$/","/^([01]\\d|2[0-4]):[0-5]\\d$/"),
('N2 limite cuerpo off-by-one (>=10000)','src/adapters/preview-adapter.ts',"task.body.length > 10000","task.body.length >= 10000"),
('N2b limite cuerpo validation off-by-one','src/domain/validation.ts',"draft.body.length > 10000","draft.body.length > 10001"),
('N3 version no incrementa al guardar','src/adapters/preview-adapter.ts',"{...valid, version: old.version + 1}","{...valid, version: old.version}"),
('N4 conflicto de version omitido','src/adapters/preview-adapter.ts',"if (old.version !== task.version) throw new Error('La versión cambió. Tu borrador se conserva.');",""),
('N5 archivo editable (saveTask)','src/adapters/preview-adapter.ts',"if (state.shifts.find((shift) => shift.id === old.shiftId)?.status !== 'open') {\n        throw new Error('Este turno está cerrado y es de solo lectura.');\n      }\n      if (old.version","if (old.version"),
('N5b renameBed archivo editable','src/adapters/preview-adapter.ts',"if (state.shifts.find((shift) => shift.id === bed.shiftId)?.status !== 'open') {\n        throw new Error('Este turno está cerrado y es de solo lectura.');\n      }\n      // La etiqueta","// La etiqueta"),
('N6 renameBed fusiona nombres duplicados (rechaza duplicado)','src/adapters/preview-adapter.ts',"bed.label = titled(label);","const t = titled(label); const dup = state.beds.find((b) => b.label === t && b.id !== id); if (dup) { state.tasks.forEach((k) => { if (k.bedId === id) k.bedId = dup.id; }); } bed.label = t;"),
('N7 nota guarda shiftId','src/adapters/preview-adapter.ts',"state.notes[index] = {id: note.id, title: titled(note.title), body: note.body, version: note.version + 1};","state.notes[index] = {...note, title: titled(note.title), version: note.version + 1};"),
('N8 groupAgenda muta el orden de entrada','src/domain/format.ts',"const sorted = [...items].sort(","const sorted = items.sort("),
('N9 respuesta tardia sobrescribe seleccion nueva','src/app/store.ts',"if (revision === startedAt && now.selection?.id === saved.id) {","if (true) {"),
('N10 fuga suscripcion notification-store','src/app/store.ts',"      unsubscribe();\n","      void unsubscribe;\n"),
('N11 fallo resetea temporal crudo','src/app/store.ts',"      } catch (error) {\n        notify(error);","      } catch (error) {\n        set({temporal: EMPTY_TEMPORAL});\n        notify(error);"),
('N12 fallo resetea draft al snapshot','src/app/store.ts',"      } catch (error) {\n        notify(error);","      } catch (error) {\n        set({draft: draftFor(get().selection, get().snapshot)});\n        notify(error);"),
('N13 load devuelve referencia (no clona)','src/adapters/preview-adapter.ts',"      return clone(state);\n    },\n    failNext","      return state;\n    },\n    failNext"),
('N14 createTask acepta cama de otro turno','src/adapters/preview-adapter.ts',"bed.id === bedId && bed.shiftId === shift.id","bed.id === bedId"),
('N15 closeShift repetido lanza','src/adapters/preview-adapter.ts',"if (shift.status === 'closed') return clone(shift);","if (shift.status === 'closed') throw new Error('Turno no activo.');"),
('N16 openShift usa fecha UTC','src/adapters/preview-adapter.ts',"date: localDate()","date: new Date().toISOString().slice(0,10)"),
('N17 persist permite doble mutacion','src/app/store.ts',"if (get().busy) return;",""),
('N18 minutos aceptan decimales','src/domain/validation.ts',"/^\\d+$/.test(value)","/^[\\d.]+$/.test(value)"),
('N19 vacio como cero en applyTemporalDraft estimate','src/domain/draft-state.ts',"estimate: String(raw.estimate).trim(),","estimate: String(raw.estimate).trim() || '0',"),
('N20 parseDate sin validar dia (31/02 pasa)','src/domain/format.ts',"date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`","false"),
('N21 conflicto en store pisa borrador con snapshot (select)','src/app/store.ts',"    const notify = (error: unknown) => notifications.notify(messageOf(error), 'error');","    const notify = (error: unknown) => { notifications.notify(messageOf(error), 'error'); set({draft: draftFor(get().selection, get().snapshot), temporal: EMPTY_TEMPORAL}); };"),
('N22 error de renameBed id mutado (regen id)','src/adapters/preview-adapter.ts',"bed.label = titled(label);","bed.label = titled(label); bed.id = `bed-${bed.label}`;"),
('N23 tarea nueva sin version 1 / HTML escapado','src/adapters/preview-adapter.ts',"const title = titled(task.title);","const title = titled(task.title).replace(/</g,'&lt;');"),
('N24 titulo 300 limite en adapter 299','src/adapters/preview-adapter.ts',"!value.trim() || value.length > 300","!value.trim() || value.length > 299"),
('N25 busy no se libera tras fallo','src/app/store.ts',"      } finally {\n        set({busy: false});\n      }","      }"),
('N26 select conserva errores previos','src/app/store.ts',"          temporal: task ? createTemporalDraft(task) : EMPTY_TEMPORAL,\n          errors: {},","          temporal: task ? createTemporalDraft(task) : EMPTY_TEMPORAL,"),
('N27 codigo SIMULATED_CONFLICT cambiado','src/adapters/preview-adapter.ts',"kind === 'conflict' ? 'SIMULATED_CONFLICT'","kind === 'conflict' ? 'SIMULATED_FAILURE'"),
('N28 select no resetea temporal','src/app/store.ts',"          temporal: task ? createTemporalDraft(task) : EMPTY_TEMPORAL,\n","          temporal: get().temporal,\n"),
('N29 saveNote exito pisa draft siempre','src/app/store.ts',"if (revision === startedAt && get().selection?.id === saved.id) {\n              set({draft: {id: saved.id, kind: 'note'","if (true) {\n              set({draft: {id: saved.id, kind: 'note'"),
('N30 setTemporalField recorta el crudo (trim)','src/app/store.ts',"set({temporal: {...get().temporal, [field]: value}});","set({temporal: {...get().temporal, [field]: value.trim()}});"),
('N31 TemporalField trim en aplicar duration omitido','src/domain/draft-state.ts',"duration: String(raw.duration).trim(),","duration: String(raw.duration),"),
]
only=sys.argv[1:] 
res=[]
for name,f,old,new in muts:
    if only and not any(name.startswith(o) for o in only): continue
    p=os.path.join(ROOT,f); orig=open(p).read()
    if orig.count(old)!=1:
        res.append((name,'BAD-PATCH',orig.count(old))); print(name,'BAD-PATCH',orig.count(old)); continue
    open(p,'w').write(orig.replace(old,new))
    try:
        r=subprocess.run('npx vitest run --project unit --maxWorkers=1 --no-file-parallelism',shell=True,cwd=ROOT,capture_output=True,text=True,env={**os.environ})
        out=r.stdout+r.stderr
        failed=re.findall(r'^\s*(?:×|✗|FAIL)\s+.*$',out,re.M)
        m=re.search(r'Tests\s+(.*)',out)
        status='CAUGHT' if r.returncode!=0 else 'SURVIVED'
        res.append((name,status,m.group(1) if m else '',sorted(set(re.findall(r'(PREVIEW-\d+|VALIDATION-\d+|DRAFT-\d+|POLISH-\d+|EMIL-SKILLS-\d+|EXTRA-[A-Z-]+)',' '.join(failed))))))
        print(name,status,m.group(1) if m else '')
        open(os.path.join(ROOT,'log-'+name.split()[0]+'.txt'),'w').write(out)
    finally:
        open(p,'w').write(orig)
json.dump(res,open(os.path.join(ROOT,'results.json'),'w'),indent=1,ensure_ascii=False)
