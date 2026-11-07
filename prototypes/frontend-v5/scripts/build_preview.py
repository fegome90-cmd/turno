"""Build a portable, offline HTML candidate. No third-party bundler required."""
from pathlib import Path
import base64,re
ROOT=Path(__file__).resolve().parents[1]
def data(path,mime):return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
css=(ROOT/'src/styles.css').read_text()
css=re.sub(r"url\('../assets/fonts/([^']+)'\)",lambda m:'url("'+data(ROOT/'assets/fonts'/m[1],'font/woff2')+'")',css)
js='\n'.join((ROOT/'src'/p).read_text() for p in ['format.mjs','home-subtitle.mjs','draft-state.mjs','validation.mjs','preview-adapter.mjs','motion.mjs','app.mjs'])
js=re.sub(r'^import .*?;\n','',js,flags=re.M);js=re.sub(r'\bexport (?=function|const)','',js)
iconmap={p.stem:data(p,'image/svg+xml') for p in sorted((ROOT/'assets/icons').glob('*.svg'))}
import json
js=js.replace('const icon=name=>','const iconAssets='+json.dumps(iconmap)+';\nconst icon=name=>').replace('./assets/icons/${name}.svg','${iconAssets[name]}')
js=js.replace('./assets/flor-negro-512.png',data(ROOT/'assets/flor-negro-512.png','image/png'))
html=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="./src/styles.css">','<style>'+css+'</style>').replace('<script type="module" src="./src/app.mjs"></script>','<script type="module">'+js.replace('</script','<\\/script')+'</script>')
notices='\n\n'.join(p.name+'\n'+p.read_text() for p in sorted((ROOT/'licenses').glob('*.txt')))
html=html.replace('</body>', '<script type="text/plain" id="third-party-licenses">'+notices.replace('</script','<\\/script')+'</script></body>')
(ROOT/'preview.html').write_text(html)
print('Built preview.html:',len(html.encode()),'bytes. No network needed.')
