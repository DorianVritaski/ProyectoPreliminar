from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    res1 = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'dictamen_ssoma'")).fetchall()
    res2 = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'solicitudes_accesos' AND column_name = 'dictamen_ssoma'")).fetchall()
    print('solicitudes.dictamen_ssoma exists:', bool(res1))
    print('solicitudes_accesos.dictamen_ssoma exists:', bool(res2))
