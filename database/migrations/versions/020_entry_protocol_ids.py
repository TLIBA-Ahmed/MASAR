"""Preserve only registry-verified workplace protocol IDs during pseudonymization."""
from alembic import op

revision='020'
down_revision='019'
branch_labels=None
depends_on=None

def upgrade():
    c=op.get_bind()
    definition=c.exec_driver_sql("SELECT pg_get_functiondef('privacy.apply(jsonb,text[],text[])'::regprocedure)").scalar_one()
    marker="   IF pair.key IN ('first_name','last_name','birth_date','personal_information') THEN CONTINUE; END IF;"
    addition="""   -- Workplace identifiers are public reference keys, not free narrative.
   IF pair.key IN ('selectedCentreId','centerId','centre_id') AND jsonb_typeof(pair.value)='string'
      AND EXISTS(SELECT 1 FROM public.centres WHERE id=pair.value#>>'{}') THEN
      result=result||jsonb_build_object(pair.key,pair.value); CONTINUE;
   END IF;
   IF pair.key IN ('governorateId','governorate_id') AND jsonb_typeof(pair.value)='string'
      AND EXISTS(SELECT 1 FROM public.governorates WHERE id=pair.value#>>'{}') THEN
      result=result||jsonb_build_object(pair.key,pair.value); CONTINUE;
   END IF;
   IF pair.key='centreIds' AND jsonb_typeof(pair.value)='array' AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(pair.value) v WHERE jsonb_typeof(v)<>'string'
      OR NOT EXISTS(SELECT 1 FROM public.centres WHERE id=v#>>'{}')) THEN
      result=result||jsonb_build_object(pair.key,pair.value); CONTINUE;
   END IF;
"""
    if marker not in definition:raise RuntimeError('Review changed privacy projection before extending reference keys')
    c.connection.driver_connection.execute(definition.replace(marker,addition+marker,1))

def downgrade():
    raise RuntimeError('Keep verified reference identifiers; use a reviewed migration')
