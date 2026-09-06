import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

// Keep originals untouched; Pillow writes small, responsive derivatives for the site.
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'assets', 'optimized');
mkdirSync(output, { recursive: true });

const python = process.env.PYTHON ?? 'python';
const script = String.raw`
from pathlib import Path
from PIL import Image

root = Path(r'''${root.replaceAll("'", "''")}''')
out = root / 'assets' / 'optimized'

def save(src, name, width, fmt='WEBP', quality=82):
    image = Image.open(root / src).convert('RGBA' if fmt == 'PNG' else 'RGB')
    if image.width > width:
        image.thumbnail((width, width), Image.Resampling.LANCZOS)
    image.save(out / name, fmt, quality=quality, method=6, optimize=True)
    print(f'{name}: {image.width}x{image.height}, {(out / name).stat().st_size} bytes')

save('assets/sev-logo.png', 'sev-logo-small.png', 192, 'PNG')
save('assets/facebook/sev-facebook-clubcollage-2025.png', 'sev-facebook-clubcollage-2025.webp', 1600)
save('assets/facebook/sev-facebook-clubcollage-2025.png', 'sev-facebook-clubcollage-2025-mobile.webp', 780)
save('assets/sev-vaan.png', 'sev-vaan.webp', 900)
save('assets/nieuwsarchief/Meidenteam-vlak-na-de-eerste-wedstrijd.jpeg', 'meidenteam-vlak-na-eerste-wedstrijd.webp', 1200)
for src, name in [('assets/sev-jeugd.jpg','sev-jeugd.webp'), ('assets/sev-senioren.jpg','sev-senioren.webp'), ('assets/sev-g-voetbal.jpg','sev-g-voetbal.webp'), ('assets/sev-vrouwen.jpg','sev-vrouwen.webp')]:
    save(src, name, 960)
for src, name in [
    ('assets/sev-de-veste.jpg','sev-de-veste.webp'),
    ('assets/sev-hele-club.jpg','sev-hele-club.webp'),
    ('assets/brandbook-preview.jpg','brandbook-preview.webp'),
    ('assets/facebook/sev-facebook-ouder-kind-2026.jpg','sev-facebook-ouder-kind-2026.webp'),
    ('assets/facebook/sev-facebook-teamvreugde-2026.jpg','sev-facebook-teamvreugde-2026.webp'),
    ('assets/nieuwsarchief/buurtrestro_20260618_5.jpeg','buurtrestro-20260618-5.webp'),
    ('assets/nieuwsarchief/G-trainers-in-het-zonnetje-2.jpg','g-trainers-in-het-zonnetje.webp'),
    ('assets/nieuwsarchief/images-blogpost-vrijwilligersavond-2026-2.jpg','vrijwilligersavond-2026.webp')
]:
    save(src, name, 960, quality=76)
`;

const result = spawnSync(python, ['-c', script], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
