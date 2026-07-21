import psycopg2

def query_local_postgres():
    try:
        conn_str = 'postgresql://postgres:postgres@localhost:5432/pumpledger'
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        cur.execute("SELECT invoice_number, image_path FROM vouchers WHERE image_path IS NOT NULL")
        rows = cur.fetchall()
        print("\nVouchers with images in Local PostgreSQL:")
        for r in rows:
            print(f"  Invoice: {r[0]}, Path: {r[1]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error reading Local PostgreSQL: {e}")

query_local_postgres()
