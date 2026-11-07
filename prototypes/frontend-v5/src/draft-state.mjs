import {parseDate,displayDate} from './format.mjs';
export function createTemporalDraft(task){return {date:task?.date?displayDate(task.date):'',time:task?.time||'',estimate:task?.estimate??'',performed:task?.performed||'',duration:task?.duration??''};}
export function applyTemporalDraft(task,raw){return {...task,date:parseDate(raw.date),time:raw.time.trim(),estimate:String(raw.estimate).trim(),performed:raw.performed.trim(),duration:String(raw.duration).trim()};}
