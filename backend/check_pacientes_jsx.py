import re

for fname in ['/app/PacientesModule.jsx', '/app/PacientesSeguridadTab.jsx', '/app/PacientesSSOMATab.jsx']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    jsx_tags = set(re.findall(r'<([A-Z][a-zA-Z0-9]+)', content))
    lucide_import_match = re.search(r'import\s+\{([^}]+)\}\s+from\s+[\'"]lucide-react[\'"]', content)
    lucide_icons = set([s.strip() for s in lucide_import_match.group(1).split(',') if s.strip()]) if lucide_import_match else set()
    missing = [t for t in jsx_tags if t not in lucide_icons]
    print(fname, "MISSING:", missing)
