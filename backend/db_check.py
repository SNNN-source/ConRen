import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb+srv://aaryanb23243csa_db_user:6VjGw3ekbmOlE9xL@conren.xtpfixf.mongodb.net/?appName=ConRen", tlsInsecure=True)
    dbs = await client.list_database_names()
    print("Databases:", dbs)
    for db_name in dbs:
        if db_name in ['admin', 'local']: continue
        db = client[db_name]
        cols = await db.list_collection_names()
        print(f"[{db_name}] collections: {cols}")
        for col in cols:
            count = await db[col].count_documents({})
            print(f" - {col}: {count} records")

asyncio.run(main())
