import psycopg2

SUPABASE_URI = "postgresql://postgres.lpovuhewyyusbxnbssne:E0pkoX0rtdAOipsf@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require"

try:
    conn = psycopg2.connect(SUPABASE_URI)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS solicitudes_accesos (
        id SERIAL PRIMARY KEY,
        codigo_acceso VARCHAR(20) UNIQUE NOT NULL,
        anfitrion_correo VARCHAR(255) NOT NULL,
        anfitrion_nombre TEXT,
        anfitrion_area TEXT,
        sede TEXT NOT NULL DEFAULT 'Campus Huancayo',
        ubicacion_especifica TEXT NOT NULL,
        motivo TEXT NOT NULL,
        fecha_inicio TIMESTAMP NOT NULL,
        fecha_fin TIMESTAMP NOT NULL,
        detalles TEXT,
        requiere_ssoma_riesgo BOOLEAN NOT NULL DEFAULT FALSE,
        lineamientos_ssoma TEXT,
        observacion_ssoma TEXT,
        url_sctr_pdf TEXT,
        url_lista_personal_pdf TEXT,
        documentos_ssoma JSON,
        visitantes JSON,
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        check_in_realizado BOOLEAN NOT NULL DEFAULT FALSE,
        fecha_check_in TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE solicitudes_accesos ALTER COLUMN motivo TYPE text;
    ALTER TABLE solicitudes_accesos ALTER COLUMN ubicacion_especifica TYPE text;
    ALTER TABLE solicitudes_accesos ALTER COLUMN anfitrion_nombre TYPE text;
    ALTER TABLE solicitudes_accesos ALTER COLUMN anfitrion_area TYPE text;
    ALTER TABLE solicitudes_accesos ALTER COLUMN sede TYPE text;
    ALTER TABLE solicitudes_accesos ALTER COLUMN url_sctr_pdf TYPE text;
    ALTER TABLE solicitudes_accesos ALTER COLUMN url_lista_personal_pdf TYPE text;
    """)
    conn.commit()
    print("Supabase migration for solicitudes_accesos executed successfully!")
    conn.close()
except Exception as e:
    print("Supabase check error (ignorable if not in use):", e)
