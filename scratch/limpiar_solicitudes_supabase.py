import psycopg2

SUPABASE_URI = 'postgresql://postgres.lpovuhewyyusbxnbssne:E0pkoX0rtdAOipsf@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require'

def main():
    print("=== LIMPIEZA DE SOLICITUDES DE PRUEBA EN SUPABASE ===\n")
    conn = psycopg2.connect(SUPABASE_URI)
    cur = conn.cursor()
    
    tablas_solicitudes = [
        'solicitud_horarios',
        'solicitud_recursos',
        'solicitudes_conformidades',
        'solicitudes'
    ]
    
    print("1. Conteo PREVIO de registros:")
    for t in tablas_solicitudes:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"   - {t}: {cur.fetchone()[0]}")

    print("\n2. Ejecutando TRUNCATE y reinicio de secuencias en tablas de solicitudes...")
    cur.execute("""
        TRUNCATE TABLE 
            solicitud_horarios,
            solicitud_recursos,
            solicitudes_conformidades,
            solicitudes
        RESTART IDENTITY CASCADE;
    """)
    conn.commit()
    print("   ✓ Registros eliminados y secuencias reiniciadas exitosamente.")

    print("\n3. Conteo POSTERIOR de verificación:")
    for t in tablas_solicitudes:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"   - {t}: {cur.fetchone()[0]}")

    print("\n4. Verificación de tablas protegidas (catálogos y usuarios intactos):")
    for t in ['ambientes', 'recursos', 'areas_destino', 'areas_solicitantes', 'usuarios_admin']:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"   - {t}: {cur.fetchone()[0]}")

    conn.close()
    print("\n🎉 ¡Base de datos en la nube limpia y lista para pruebas en blanco!")

if __name__ == "__main__":
    main()
