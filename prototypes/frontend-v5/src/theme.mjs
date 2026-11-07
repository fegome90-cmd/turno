// Session-only preference. No storage, network, profile or domain-model changes.
export function createTheme({root, matchMedia, onChange=()=>{}}) {
 const media=matchMedia?.('(prefers-color-scheme: dark)');
 let preference='system';
 function apply(){
  const effective=preference==='system'?(media?.matches?'dark':'light'):preference;
  root.dataset.theme=effective;
  root.dataset.themePreference=preference;
  onChange({preference,effective});
 }
 const systemChanged=()=>{if(preference==='system')apply();};
 if(media?.addEventListener)media.addEventListener('change',systemChanged);
 else media?.addListener?.(systemChanged);
 apply();
 return {
  get preference(){return preference;},
  setPreference(next){if(!['system','light','dark'].includes(next))return false;preference=next;apply();return true;},
 };
}
