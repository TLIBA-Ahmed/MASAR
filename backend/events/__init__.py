import json
from sqlalchemy import text


def audit(connection,employee,action,kind,resource_id=None,success=True,**metadata):
    # Metadata is constructed by application code. Never pass narratives or raw prompts here.
    connection.execute(text('INSERT INTO audit_events(employee_id,action,resource_type,resource_id,success,metadata) VALUES(:e,:a,:t,:id,:success,CAST(:metadata AS jsonb))'),{'e':employee,'a':action,'t':kind,'id':resource_id,'success':success,'metadata':json.dumps(metadata)})


def publish(connection,employee,event,aggregate_id,version=1,**metadata):
    connection.execute(text('INSERT INTO outbox_events(employee_id,event_type,aggregate_id,source_version,payload) VALUES(:e,:event,:id,:version,CAST(:payload AS jsonb))'),{'e':employee,'event':event,'id':aggregate_id,'version':version,'payload':json.dumps(metadata)})
