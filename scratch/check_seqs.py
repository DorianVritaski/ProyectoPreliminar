import psycopg2

SUPABASE_URI = 'postgresql://postgres.lpovuhewyyusbxnbssne:E0pkoX0rtdAOipsf@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require'

def main():
    conn = psycopg2.connect(SUPABASE_URI)
    cur = conn.cursor()
    cur.execute("""
        SELECT sequence_name 
        FROM information_schema.sequences;
    """)
    for row in cur.fetchall():
        print("Sequence:", row[0])
    conn.close()

if __name__ == "__main__":
    main()
