import psycopg2

SUPABASE_URI = 'postgresql://postgres.lpovuhewyyusbxnbssne:E0pkoX0rtdAOipsf@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require'

try:
    conn = psycopg2.connect(SUPABASE_URI)
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = 'solicitudes' 
        AND column_name IN ('estado', 'edicion_solicitada', 'motivo_modificacion', 'pin_seguridad');
    """)
    for row in cur.fetchall():
        print("Column:", row)
    conn.close()
    print("Supabase check completed successfully.")
except Exception as e:
    print("Error:", e)
