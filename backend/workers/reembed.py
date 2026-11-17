"""Rebuild only derived missing vectors, with the restricted indexing principal."""
import json
from sqlalchemy import text
from ..db import transaction,rows
from ..ai_client import gateway
def main():
    count=0
    while True:
        with transaction(principal='worker') as c:
            batch=rows(c,'SELECT id,chunk_text FROM document_chunks WHERE embedding IS NULL ORDER BY id LIMIT 8 FOR UPDATE SKIP LOCKED')
            if not batch:break
            vectors=gateway.embeddings([r['chunk_text'] for r in batch],'passage')
            for row,vector in zip(batch,vectors):
                c.execute(text("UPDATE document_chunks SET embedding=CAST(:vector AS vector),embedding_model_version='multilingual-e5-small@614241f6' WHERE id=:id"),{'vector':json.dumps(vector),'id':row['id']});count+=1
    print(f'Derived local vectors rebuilt: {count}. No source record changed.')
if __name__=='__main__':main()
